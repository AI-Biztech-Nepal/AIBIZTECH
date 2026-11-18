import { redirect } from 'next/navigation';
import { getContext } from './supabase';

// Signed in, has a business, and that business has Stock Manager. Creates the business's stock record on first use.
export async function getStock() {
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  if (!org) redirect('/onboarding');
  if (!org.services.stock) redirect('/?error=' + encodeURIComponent('You do not have access to Stock Manager.'));
  const stock = supabase.schema('stock');
  const { error } = await supabase.schema('stock').rpc('ensure_company', { p_org: org.id });
  return { supabase, stock, ctx, org, setupError: error?.message ?? null };
}

export const money = (n: number | null | undefined) => 'Rs ' + Math.round(n ?? 0).toLocaleString('en-IN');
