import React from 'react';
import { buildFullState } from '@/lib/state';
import { getSessionUser } from '@/lib/auth';
import LMSClientApp from '@/components/LMSClientApp';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const sessionUser = await getSessionUser();
  const initialState = buildFullState(sessionUser);
  return <LMSClientApp initialState={initialState} />;
}
