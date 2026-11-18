import { redirect } from 'next/navigation';
import { getContext } from './supabase';

// Signed in, has a business, and that business has Marketing. Makes the business's stock record on first use.
export async function getMarketing() {
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  if (!org) redirect('/onboarding');
  if (!org.services.marketing) redirect('/?error=' + encodeURIComponent('You do not have access to Marketing.'));
  const { error } = await supabase.schema('stock').rpc('ensure_company', { p_org: org.id });
  return { supabase, db: supabase.schema('stock'), ctx, org, setupError: error?.message ?? null, isAdmin: org.services.marketing === 'admin' };
}
