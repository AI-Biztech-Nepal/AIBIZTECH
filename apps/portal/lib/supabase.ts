import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Session cookie lives on the parent domain so every service subdomain can read it
export const cookieOptions: CookieOptionsWithName = {
  domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list) {
        // Server Components cannot set cookies; proxy.ts refreshes the session instead
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {}
      },
    },
  });
}

export type Org = { id: string; name: string; org_role: 'owner' | 'admin' | 'member'; verification_status: 'pending' | 'verified' | 'rejected'; verification_note: string | null; services: Record<string, string> };
export type Context = { user_id: string; full_name: string | null; active_org_id: string | null; orgs: Org[] };

export async function getContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.schema('core').rpc('my_context');
  if (error) throw error;
  return { supabase, ctx: data as Context | null };
}
