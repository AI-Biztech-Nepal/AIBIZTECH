import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase';
import { safeNext } from '@/lib/safe-next';
import { sendTo } from '@/lib/send-to';

// Email confirmation and password-reset links land here with a one-time code
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return sendTo(next);
  }
  return sendTo('/login?error=' + encodeURIComponent('That link is invalid or has expired.'));
}
