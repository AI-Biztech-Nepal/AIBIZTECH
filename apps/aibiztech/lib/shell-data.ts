import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { businessKind } from './business-kind-load';
import { hiddenModules } from './hidden-modules';
import { hasOldFinance } from './old-finance';
import type { Org } from './supabase';

// What the frame around every page needs, asked all at once because each trip to the database takes time. A page that
// needs the same things starts this early; the answers are shared for the whole request.
export const shellData = cache(async (supabase: SupabaseClient, org: Org | null) => {
  const [{ data: services }, kind, hidden] = await Promise.all([
    supabase.schema('core').from('services').select('key, name, base_url').eq('is_active', true).order('name'),
    org && (org.services.stock || org.services.finance) ? businessKind(supabase, org.id) : null,
    org ? hiddenModules(supabase, org.id) : [],
  ]);
  const auto = !!org?.services.stock && kind === 'auto';
  const oldFinance = org && auto ? await hasOldFinance(supabase, org.id) : false;
  return { services, auto, oldFinance, hidden };
});
