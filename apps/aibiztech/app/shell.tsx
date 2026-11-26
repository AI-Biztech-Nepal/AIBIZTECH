import type { ReactNode } from 'react';
import { createClient, type Org } from '@/lib/supabase';
import { PortalFrame, type Page } from './portal-frame';

// Loads what the frame needs (the apps and who is signed in) and draws it around the page
export async function Shell({ org, orgs, page, bleed, light, children }: { org: Org | null; orgs?: Org[]; page: Page; bleed?: boolean; light?: boolean; children: ReactNode }) {
  const supabase = await createClient();
  const [{ data: services }, { data: claims }] = await Promise.all([
    supabase.schema('core').from('services').select('key, name, base_url').eq('is_active', true).order('name'),
    supabase.auth.getClaims(),
  ]);
  const email = claims?.claims.email ?? '';
  const person = (claims?.claims.user_metadata as { full_name?: string } | undefined)?.full_name || email.split('@')[0] || 'Account';

  return (
    <PortalFrame org={org} orgs={orgs} services={services} person={person} email={email} page={page} bleed={bleed} light={light}>
      {children}
    </PortalFrame>
  );
}
