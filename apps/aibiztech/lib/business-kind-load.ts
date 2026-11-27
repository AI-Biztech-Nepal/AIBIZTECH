import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { kindFrom, type BusinessKind } from './business-kind';

export const businessKind = cache(async (supabase: SupabaseClient, org: string): Promise<BusinessKind | null> => {
  const core = supabase.schema('core');
  const [{ data: business, error }, { data: switches }, { data: earlier }] = await Promise.all([
    core.from('organizations').select('business_type').eq('id', org).maybeSingle(),
    core.from('org_features').select('feature_key, enabled').eq('org_id', org).in('feature_key', ['stock.vehicles', 'finance.vehicles']),
    supabase.schema('finance').from('org_settings').select('sells_vehicles').eq('org_id', org).maybeSingle(),
  ]);
  const on = (key: string) => (switches as { feature_key: string; enabled: boolean }[] | null)?.find((s) => s.feature_key === key)?.enabled;
  const kind = kindFrom((business as { business_type?: string | null } | null)?.business_type, {
    stockPack: on('stock.vehicles'), financePack: on('finance.vehicles'), sellsVehicles: (earlier as { sells_vehicles?: boolean } | null)?.sells_vehicles,
  });
  return kind ?? (error ? 'general' : null); // if the business cannot be read, do not send anyone to be asked
});
