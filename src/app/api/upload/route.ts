import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { getSessionUser, verifyCsrfOrigin } from '@/lib/auth';

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.mp4',
  '.vtt',
]);

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB hard cap

export async function POST(req: Request) {
  try {
    const csrfOk = await verifyCsrfOrigin(req);
    if (!csrfOk) {
      return NextResponse.json({ error: 'Cross-origin upload forbidden.' }, { status: 403 });
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Authentication required to upload files.' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File size exceeds the 50 MB limit.' }, { status: 413 });
    }

    const ext = path.extname(file.name || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed formats: PDF, DOCX, PNG, JPG, WEBP, MP4, VTT.' },
        { status: 400 }
      );
    }

    // Only staff can upload video files
    if (ext === '.mp4' && sessionUser.role === 'student') {
      return NextResponse.json({ error: 'Only instructors and administrators can upload video lectures.' }, { status: 403 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File size exceeds the 50 MB limit.' }, { status: 413 });
    }

    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const sizeKB = Math.max(1, Math.round(buffer.length / 1024));
    const sizeLabel = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
    const safeFileName = path.basename(file.name).replace(/[^a-zA-Z0-9._ -]/g, '_');

    try {
      if (process.env.VERCEL) {
        throw new Error('Serverless read-only public dir');
      }
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, uniqueName);
      fs.writeFileSync(filePath, buffer, { flag: 'wx' });

      return NextResponse.json({
        ok: true,
        url: `/uploads/${uniqueName}`,
        fileName: safeFileName,
        sizeLabel,
      });
    } catch {
      const mimeMap: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.vtt': 'text/vtt',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
      const mimeType = file.type || mimeMap[ext] || 'application/octet-stream';
      const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
      return NextResponse.json({
        ok: true,
        url: dataUrl,
        fileName: safeFileName,
        sizeLabel,
      });
    }
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
