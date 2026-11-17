import type { SupabaseClient } from '@supabase/supabase-js';
import type { Raw } from '@/lib/books';

// Every row of one Finance table for the business, in pages (the API returns at most 1000 rows per request)
async function rows<T>(supabase: SupabaseClient, table: string, cols: string, org: string, order?: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 30; page++) {
    let q = supabase.schema('finance').from(table).select(cols).eq('owner_id', org);
    if (order) q = q.order(order);
    const { data, error } = await q.range(page * 1000, page * 1000 + 999);
    if (error || !data) break;
    out.push(...(data as unknown as T[]));
    if (data.length < 1000) break;
  }
  return out;
}

export async function loadRaw(supabase: SupabaseClient, org: string): Promise<Raw | null> {
  try {
    const [txs, cl, vl, accounts, transfers, parties, categories] = await Promise.all([
      rows(supabase, 'business_transactions', 'id, type, amount, customer_id, party_name, bill_date, created_at, bank_account_id, expense_category_id', org, 'created_at'),
      rows(supabase, 'customer_ledger_entries', 'id, customer_id, entry_type, amount, source, bank_account_id, entry_date, note, created_at', org, 'created_at'),
      rows(supabase, 'vendor_ledger_entries', 'id, vendor_id, entry_type, amount, source, bank_account_id, entry_date, note, created_at', org, 'created_at'),
      rows(supabase, 'bank_accounts', 'id, name', org),
      rows(supabase, 'account_transfers', 'from_account_id, to_account_id, amount', org),
      rows(supabase, 'customers', 'id, name', org),
      rows(supabase, 'expense_categories', 'id, name', org),
    ]);
    return { txs, cl, vl, accounts, transfers, parties, categories } as Raw;
  } catch {
    return null; // Finance not reachable: the dashboard simply leaves the money panels out
  }
}
