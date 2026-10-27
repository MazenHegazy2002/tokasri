import LMSClientApp from '@/components/LMSClientApp';
import { getSessionUser } from '@/lib/auth';
import { buildFullState } from '@/lib/state';

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const sessionUser = await getSessionUser();
  const initialState = buildFullState(sessionUser);
  return <LMSClientApp initialState={initialState} initialPortal="public" initialSubRoute="contact" />;
}
