import type { ReactNode } from 'react';
import { createClient, type Org } from '@/lib/supabase';
import { businessKind } from '@/lib/business-kind-load';
import { hiddenModules } from '@/lib/hidden-modules';
import { hasOldFinance } from '@/lib/old-finance';
import { PortalFrame, type Page } from './portal-frame';

// Loads what the frame needs (the apps and who is signed in) and draws it around the page
export async function Shell({ org, orgs, page, bleed, light, phoneDate, children }: { org: Org | null; orgs?: Org[]; page: Page; bleed?: boolean; light?: boolean; phoneDate?: string; children: ReactNode }) {
  const supabase = await createClient();
  const [{ data: services }, { data: claims }] = await Promise.all([
    supabase.schema('core').from('services').select('key, name, base_url').eq('is_active', true).order('name'),
    supabase.auth.getClaims(),
  ]);
  const email = claims?.claims.email ?? '';
  const auto = org?.services.stock ? (await businessKind(supabase, org.id)) === 'auto' : false;
  const oldFinance = org && auto ? await hasOldFinance(supabase, org.id) : false;
  const hidden = org ? await hiddenModules(supabase, org.id) : [];
  const person = (claims?.claims.user_metadata as { full_name?: string } | undefined)?.full_name || email.split('@')[0] || 'Account';

  return (
    <PortalFrame org={org} orgs={orgs} services={services} person={person} email={email} page={page} bleed={bleed} auto={auto} oldFinance={oldFinance} hidden={hidden} light={light} phoneDate={phoneDate}>
      {children}
    </PortalFrame>
  );
}
