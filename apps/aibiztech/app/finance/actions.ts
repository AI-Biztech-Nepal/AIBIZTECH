'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const num = (f: FormData, k: string) => Number(str(f, k));
const back = (path: string, kind: 'error' | 'message', text: string): never => redirect(`${path}?${kind}=${encodeURIComponent(text)}`);
const fin = async () => (await createClient()).schema('finance');

export async function addParty(form: FormData) {
  const name = str(form, 'name');
  if (!name) back('/finance/parties', 'error', 'Enter a name.');
  const { error } = await (await fin()).from('customers').insert({ name, phone: str(form, 'phone') || null, address: str(form, 'address') || null });
  if (error) back('/finance/parties', 'error', error.code === '23505' ? 'A party with this phone number already exists.' : error.message);
  revalidatePath('/finance', 'layout');
  back('/finance/parties', 'message', `${name} added.`);
}

export async function addAccount(form: FormData) {
  const name = str(form, 'name');
  if (!name) back('/finance/accounts', 'error', 'Enter an account name.');
  const { error } = await (await fin()).from('bank_accounts').insert({ name, bank_name: str(form, 'bank_name') || null, account_number: str(form, 'account_number') || null });
  if (error) back('/finance/accounts', 'error', error.code === '23505' ? 'You already have an account with this name.' : error.message);
  revalidatePath('/finance', 'layout');
  back('/finance/accounts', 'message', `${name} added.`);
}

export async function addTransfer(form: FormData) {
  const from = str(form, 'from') === 'cash' ? null : str(form, 'from');
  const to = str(form, 'to') === 'cash' ? null : str(form, 'to');
  const amount = num(form, 'amount');
  if (from === to) back('/finance/accounts', 'error', 'Choose two different accounts.');
  if (!(amount > 0)) back('/finance/accounts', 'error', 'Enter an amount above zero.');
  const { error } = await (await fin()).from('account_transfers').insert({ from_account_id: from, to_account_id: to, amount, note: str(form, 'note') || null, transfer_date: str(form, 'date') || new Date().toISOString().slice(0, 10) });
  if (error) back('/finance/accounts', 'error', error.message);
  revalidatePath('/finance', 'layout');
  back('/finance/accounts', 'message', 'Transfer saved.');
}

// Sale / purchase bill or expense. A bill to a saved party books a debt (a database trigger does that); money moves with a payment.
export async function addTransaction(form: FormData) {
  const type = str(form, 'type');
  const amount = num(form, 'amount');
  if (!['sale', 'purchase', 'expense'].includes(type)) back('/finance/transactions', 'error', 'Choose what this entry is.');
  if (!(amount > 0)) back('/finance/transactions', 'error', 'Enter an amount above zero.');
  const customer_id = type === 'expense' ? null : str(form, 'party') || null;
  const account = str(form, 'account');
  const { error } = await (await fin()).from('business_transactions').insert({
    type, amount, customer_id, note: str(form, 'note') || null, bill_no: str(form, 'bill_no') || null,
    bill_date: str(form, 'date') || new Date().toISOString().slice(0, 10),
    party_name: str(form, 'party_name') || null,
    payment_mode: !account || account === 'cash' ? 'cash' : 'bank',
    bank_account_id: account && account !== 'cash' ? account : null,
  });
  if (error) back('/finance/transactions', 'error', error.message);
  revalidatePath('/finance', 'layout');
  back('/finance/transactions', 'message', 'Entry saved.');
}

// Money received from a customer, or paid to a vendor
export async function addPayment(form: FormData) {
  const party = str(form, 'party');
  const received = str(form, 'direction') === 'received';
  const amount = num(form, 'amount');
  if (!party) back('/finance/transactions', 'error', 'Choose a party.');
  if (!(amount > 0)) back('/finance/transactions', 'error', 'Enter an amount above zero.');
  const account = str(form, 'account');
  const row = { entry_type: 'credit', amount, note: str(form, 'note') || null, entry_date: str(form, 'date') || new Date().toISOString().slice(0, 10), bank_account_id: account && account !== 'cash' ? account : null };
  const { error } = received
    ? await (await fin()).from('customer_ledger_entries').insert({ ...row, customer_id: party })
    : await (await fin()).from('vendor_ledger_entries').insert({ ...row, vendor_id: party });
  if (error) back('/finance/transactions', 'error', error.message);
  revalidatePath('/finance', 'layout');
  back('/finance/transactions', 'message', received ? 'Payment received saved.' : 'Payment made saved.');
}
