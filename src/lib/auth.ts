import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { getDb } from './db';

const SESSION_COOKIE_NAME = 'sri_session';
// Derive a deterministic local server secret if SESSION_SECRET env var is not explicitly set
const SERVER_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update('sri-epnu-lms-secret-key-2026-v1').digest('hex');

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'coadmin' | 'student';
  student_id_code: string;
  faculty: string;
  year_level: number;
  plan: string;
  membership_renews: string;
  last_active: string;
  avatar_initials: string;
}

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!plain || !stored) return false;
  if (stored.startsWith('scrypt:')) {
    const parts = stored.split(':');
    if (parts.length !== 3) return false;
    const [, salt, hashHex] = parts;
    const derived = crypto.scryptSync(plain, salt, 64);
    const expected = Buffer.from(hashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }
  // Fallback constant-time check for legacy plaintext if ever encountered
  const a = Buffer.from(plain);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function signSessionToken(userId: string, role: string): string {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 1000 * 60 * 60 * 24 * 7; // 7 days
  const payload = Buffer.from(JSON.stringify({ sub: userId, role, iat: issuedAt, exp: expiresAt })).toString('base64url');
  const sig = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): { sub: string; role: string } | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.sub || typeof decoded.exp !== 'number' || Date.now() > decoded.exp) {
      return null;
    }
    return { sub: decoded.sub, role: decoded.role };
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string, role: string) {
  const token = signSessionToken(userId, role);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    const verified = verifySessionToken(token);
    if (!verified) return null;

    const db = getDb();
    const user = db
      .prepare(
        `SELECT id, name, email, role, student_id_code, faculty, year_level, plan, membership_renews, last_active, avatar_initials
         FROM users WHERE id = ?`
      )
      .get(verified.sub) as unknown as SessionUser | undefined;

    if (!user) return null;
    return JSON.parse(JSON.stringify(user));
  } catch {
    return null;
  }
}

export async function verifyCsrfOrigin(req: Request): Promise<boolean> {
  try {
    const hdrs = await headers();
    const origin = hdrs.get('origin');
    const host = hdrs.get('host') || new URL(req.url).host;
    if (!origin) {
      // Same-origin fetch or non-browser client without Origin header
      return true;
    }
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

// In-memory sliding window rate limiter for authentication endpoints
const authAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkAuthRateLimit(key: string, maxAttempts = 10, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = authAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    authAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count += 1;
  return true;
}

export function resetAuthRateLimit(key: string) {
  authAttempts.delete(key);
}
