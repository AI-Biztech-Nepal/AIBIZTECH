import { NextResponse, type NextRequest } from 'next/server';
import { getContext } from '@/lib/supabase';
import { signSsoToken } from '@/lib/sso';

// Open app: checks the person may use the service, then hands them to it already signed in
export async function GET(req: NextRequest, { params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  const home = (msg: string) => NextResponse.redirect(new URL('/?error=' + encodeURIComponent(msg), req.url));

  const { supabase, ctx } = await getContext();
  if (!ctx) return NextResponse.redirect(new URL('/login', req.url));
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  const role = org?.services[service];
  if (!org || !role) return home('You do not have access to that app.');

  const { data: svc } = await supabase.schema('core').from('services').select('base_url').eq('key', service).eq('is_active', true).maybeSingle();
  if (!svc) return home('That app is not available.');

  // ?to=/inventory opens that page of the app (a path on the app only; anything else is ignored)
  const asked = req.nextUrl.searchParams.get('to') ?? '/';
  const to = asked.startsWith('/') && !asked.startsWith('//') ? asked : '/';
  const embed = req.nextUrl.searchParams.get('embed') === '1';
  const base = svc.base_url.replace(/\/$/, '');
  const marker = embed ? 'embed=1' : 'from=aibiztech';
  const joiner = to.includes('?') ? '&' : '?';

  // Single sign-on only for apps that have the /sso page (listed in SSO_SERVICES, e.g. "attendance,stock"); the rest open as they are
  const ssoApps = (process.env.SSO_SERVICES ?? '').split(',').map((s) => s.trim());
  const secret = ssoApps.includes(service) ? process.env.SSO_SECRET : undefined;
  const { data: claims } = await supabase.auth.getClaims();
  const email = claims?.claims.email;
  // Without a shared secret, fall back to opening the app and letting it ask for a login
  if (!secret || !email) return NextResponse.redirect(`${base}${to}${joiner}${marker}`);

  const token = signSsoToken(
    { sub: ctx.user_id, email, name: ctx.full_name ?? '', org_id: org.id, org_name: org.name, org_role: org.org_role, service, role },
    secret,
  );
  // The token sits in the URL fragment, which browsers never send to servers or put in logs
  return NextResponse.redirect(`${base}/sso?to=${encodeURIComponent(to)}&${marker}#token=${token}`);
}
