import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { kindFrom, type BusinessKind } from './business-kind';

export const businessKind = cache(async (supabase: SupabaseClient, org: string): Promise<BusinessKind> => {
  const core = supabase.schema('core');
  const [{ data: business }, { data: pack }] = await Promise.all([
    core.from('organizations').select('business_type').eq('id', org).maybeSingle(),
    core.from('org_features').select('enabled').eq('org_id', org).eq('feature_key', 'stock.vehicles').maybeSingle(),
  ]);
  return kindFrom((business as { business_type?: string | null } | null)?.business_type, (pack as { enabled?: boolean } | null)?.enabled);
});
