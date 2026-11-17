import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase';
import { computeBooks, type Account, type Entry, type Party, type Transfer, type Tx } from '@/lib/finance';

// Everything a Finance screen needs, for the business the person is working in
export async function loadBooks() {
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  if (!org) redirect('/onboarding');
  if (!org.services.finance) redirect('/?error=' + encodeURIComponent('You do not have access to Finance in ' + org.name + '.'));

  const fin = supabase.schema('finance');
  const [parties, accounts, txs, cl, vl, transfers] = await Promise.all([
    fin.from('customers').select('id, name, phone, address').eq('owner_id', org.id).order('name'),
    fin.from('bank_accounts').select('id, name, bank_name, account_number').eq('owner_id', org.id).order('name'),
    fin.from('business_transactions').select('id, type, amount, customer_id, party_name, bill_no, bill_date, note, bank_account_id, created_at').eq('owner_id', org.id).order('created_at', { ascending: false }),
    fin.from('customer_ledger_entries').select('id, customer_id, entry_type, amount, source, bank_account_id, entry_date, note, created_at').eq('owner_id', org.id),
    fin.from('vendor_ledger_entries').select('id, vendor_id, entry_type, amount, source, bank_account_id, entry_date, note, created_at').eq('owner_id', org.id),
    fin.from('account_transfers').select('from_account_id, to_account_id, amount').eq('owner_id', org.id),
  ]);
  const failure = [parties, accounts, txs, cl, vl, transfers].find((r) => r.error)?.error;
  const data = {
    parties: (parties.data ?? []) as Party[], accounts: (accounts.data ?? []) as Account[], txs: (txs.data ?? []) as Tx[],
    customerLedger: (cl.data ?? []) as Entry[], vendorLedger: (vl.data ?? []) as Entry[], transfers: (transfers.data ?? []) as Transfer[],
  };
  return { ctx, org, ...data, failure: failure?.message, books: computeBooks(data) };
}
