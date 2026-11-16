import { createBrowserClient } from '@supabase/ssr';

export type Ctx = {
  user_id: string;
  full_name: string | null;
  active_org_id: string | null;
  orgs: { id: string; name: string; org_role: 'owner' | 'admin' | 'member'; services: Record<string, string> }[];
};

// Each app maps its own env prefix (NEXT_PUBLIC_, VITE_, EXPO_PUBLIC_) and passes the values in
export type Config = { supabaseUrl: string; anonKey: string; portalUrl: string; cookieDomain?: string };

let config: Config | undefined;
let client: ReturnType<typeof createBrowserClient> | undefined;

export function configure(c: Config) {
  config = c;
  client = undefined;
}

function need(): Config {
  if (!config) throw new Error('Call configure() from @ai-biztech-nepal/auth first');
  return config;
}

// Session cookie lives on the parent domain so every service subdomain shares one sign-in
export function getSupabase() {
  const c = need();
  return (client ??= createBrowserClient(c.supabaseUrl, c.anonKey, {
    cookieOptions: { domain: c.cookieDomain || undefined, path: '/', sameSite: 'lax', secure: location.protocol === 'https:' },
  }));
}

export function loginUrl(next: string) {
  return `${need().portalUrl}/login?next=${encodeURIComponent(next)}`;
}

export function deniedUrl(serviceKey: string) {
  return `${need().portalUrl}/?denied=${encodeURIComponent(serviceKey)}`;
}

export type Access =
  | { ok: true; ctx: Ctx; orgId: string; role: string; accessToken: string }
  | { ok: false; redirectTo: string };

// Guard for a service's root layout: the caller redirects to redirectTo when ok is false
export async function requireService(serviceKey: string, next = location.href): Promise<Access> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, redirectTo: loginUrl(next) };

  const { data } = await supabase.schema('core').rpc('my_context');
  const ctx = data as Ctx | null;
  const org = ctx?.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx?.orgs[0];
  const role = org?.services[serviceKey];
  if (!ctx || !org || !role) return { ok: false, redirectTo: deniedUrl(serviceKey) };
  return { ok: true, ctx, orgId: org.id, role, accessToken: session.access_token };
}

// fetch for Family B backends: adds the bearer token and org header that aibiz_auth expects
export async function apiFetch(url: string, orgId: string, init: RequestInit = {}) {
  const { data: { session } } = await getSupabase().auth.getSession();
  const headers = new Headers(init.headers);
  if (session) headers.set('Authorization', `Bearer ${session.access_token}`);
  headers.set('X-Org-Id', orgId);
  return fetch(url, { ...init, headers });
}

// Every feature of one org in a single call, e.g. { 'finance.emi': true }. A key that is missing means the catalogue
// default, which the service must apply itself (installed apps and bridges must never treat missing as off).
export async function loadFeatures(orgId: string): Promise<Record<string, boolean>> {
  const { data } = await getSupabase().schema('core').rpc('org_features', { p_org: orgId });
  return Object.fromEntries(((data ?? []) as { feature_key: string; enabled: boolean }[]).map((f) => [f.feature_key, f.enabled]));
}

// requireService for the feature's service, then the switch; denied sends the person to the portal like a missing service
export async function requireFeature(featureKey: string, next = location.href): Promise<Access> {
  const access = await requireService(featureKey.split('.')[0], next);
  if (!access.ok) return access;
  const features = await loadFeatures(access.orgId);
  return features[featureKey] ? access : { ok: false, redirectTo: deniedUrl(featureKey) };
}
