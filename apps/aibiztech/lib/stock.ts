import { redirect } from 'next/navigation';
import { getContext } from './supabase';

// Signed in, has a business, and that business has Stock Manager. Creates the business's stock record on first use.
// Pass 'vehicles' on pages that only make sense for a business that sells vehicles: others are sent to Items.
export async function getStock(need?: 'vehicles') {
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  if (!org) redirect('/onboarding');
  if (!org.services.stock) redirect('/?error=' + encodeURIComponent('You do not have access to Stock Manager.'));
  const stock = supabase.schema('stock');
  const { error } = await supabase.schema('stock').rpc('ensure_company', { p_org: org.id });
  // off unless the business turned vehicles on
  const { data: company } = await stock.from('companies').select('sells_vehicles').eq('id', org.id).maybeSingle();
  const sellsVehicles = company?.sells_vehicles === true;
  if (need === 'vehicles' && !sellsVehicles) redirect('/stock/items');
  return { supabase, stock, ctx, org, setupError: error?.message ?? null, sellsVehicles };
}

export const money = (n: number | null | undefined) => 'Rs ' + Math.round(n ?? 0).toLocaleString('en-IN');
