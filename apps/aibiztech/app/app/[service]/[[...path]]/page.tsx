import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase';
import { AppFrame } from '../../../app-frame';
import { Shell } from '../../../shell';

// Live addresses used if the saved one is missing or points back at the portal itself
const LIVE: Record<string, string> = {
  attendance: process.env.ATTENDANCE_LIVE_URL ?? 'https://attendance-nepal.com',
};

type Props = { params: Promise<{ service: string; path?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// /app/attendance, /app/stock/finance?tab=daybook, /app/finance/daybook ...: the app's own page, inside the portal
export default async function AppPage({ params, searchParams }: Props) {
  const { service, path = [] } = await params;
  const query = await searchParams;
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  if (!org) redirect('/onboarding');
  // The Marketing screens are part of Stock Manager, so they open with the business's Stock Manager access
  const key = service === 'marketing' ? 'stock' : service;
  if (!org.services[key]) redirect('/?error=' + encodeURIComponent('You do not have access to that app.'));

  const { data: svc } = await supabase.schema('core').from('services').select('name, base_url').eq('key', key).eq('is_active', true).maybeSingle();
  if (!svc) redirect('/?error=' + encodeURIComponent('That app is not available.'));

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) qs.append(k, one);
  const target = `/${path.map(encodeURIComponent).join('/')}`;
  const search = qs.toString() ? `?${qs}` : '';

  let src: string;
  if (key === 'stock') {
    // The portal hands the app a signed pass for the person signed in here
    const page = service === 'marketing' && target === '/' ? '/marketing' : target;
    src = `/go/stock?to=${encodeURIComponent(page + search)}&embed=1`;
  } else if (service === 'finance') {
    // Finance is part of the portal itself (static files at /finance)
    src = `/finance${target === '/' ? '' : target}${search}`;
  } else if (service === 'attendance' && process.env.ATTENDANCE_URL) {
    // First open: the business gets its Attendance company and the person their Attendance profile
    const { error: wsError } = await supabase.schema('attendance').rpc('ensure_workspace', { p_org: org.id });
    if (wsError) redirect('/?error=' + encodeURIComponent('Could not set up Attendance: ' + wsError.message));
    // The fresh copy is served under the portal's own address, so the portal sign-in already applies: no second login
    src = `/attendance${target === '/' ? '' : target}${search}`;
  } else {
    const host = (await headers()).get('host') ?? '';
    let base = svc.base_url.replace(/\/$/, '');
    try { if (new URL(base).host === host) base = LIVE[service] ?? base; } catch { base = LIVE[service] ?? base; }
    const sso = !!process.env.SSO_SECRET && (process.env.SSO_SERVICES ?? '').split(',').map((s) => s.trim()).includes(service);
    // With single sign-on the portal hands the app a signed pass; otherwise the app's own login shows inside the frame
    src = sso ? `/go/${service}?to=${encodeURIComponent(target + search)}&embed=1` : `${base}${target}${search}${search ? '&' : '?'}embed=1`;
  }

  return (
    <Shell org={org} orgs={ctx.orgs} page="frame" bleed>
      <AppFrame key={`${org.id}:${src}`} src={src} title={svc.name} app={key} />
    </Shell>
  );
}
