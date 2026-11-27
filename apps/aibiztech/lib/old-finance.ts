import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// Whether this business has records in the portal's earlier Finance app. A business with Stock Manager sees Stock
// Manager's Finance; the earlier one stays in its menu only if it holds something. Unsure (an error) counts as yes.
export const hasOldFinance = cache(async (supabase: SupabaseClient, org: string): Promise<boolean> => {
  const found = await Promise.all(['business_transactions', 'customer_ledger_entries', 'vendor_ledger_entries'].map((table) =>
    supabase.schema('finance').from(table).select('id', { count: 'exact', head: true }).eq('owner_id', org)));
  return found.some((r) => !!r.error || (r.count ?? 0) > 0);
});
