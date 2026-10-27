import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { buildFullState } from '@/lib/state';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    const state = buildFullState(sessionUser);
    return NextResponse.json(state);
  } catch {
    return NextResponse.json({ error: 'Failed to load state' }, { status: 500 });
  }
}
