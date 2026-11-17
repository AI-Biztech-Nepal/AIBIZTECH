import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, supabaseAdminConfigured } from '@/lib/supabase-admin';
import { verifySsoToken } from '@/lib/sso';

export const runtime = 'nodejs';

// Single sign-on from AIBIZTECH: checks the signed token, makes sure the person has an account here
// (new ones get a company named after their AIBIZTECH business), and returns a one-time login code.
export async function POST(req: NextRequest) {
  const secret = process.env.SSO_SECRET?.trim();
  if (!secret || !supabaseAdminConfigured) {
    return NextResponse.json({ error: 'Single sign-on is not configured on this server.' }, { status: 500 });
  }
  const body = await req.json().catch(() => null);
  const claims = typeof body?.token === 'string' ? verifySsoToken(body.token, secret) : null;
  if (!claims) return NextResponse.json({ error: 'This sign-in link is invalid or has expired. Open the app again from AIBIZTECH.' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const email = claims.email.trim().toLowerCase();
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: claims.name || email, company_name: claims.org_name },
  });
  // An existing account is fine: they just sign in to it
  if (createError && !/already|registered|exists/i.test(createError.message)) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message ?? 'Could not sign you in.' }, { status: 400 });
  }
  return NextResponse.json({ token_hash: data.properties.hashed_token });
}
