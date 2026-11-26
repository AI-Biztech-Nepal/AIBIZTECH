import { notFound } from 'next/navigation';
import { computeDashboard, type Raw } from '@/lib/books';
import type { Org } from '@/lib/supabase';
import { DashboardView } from '../../dashboard-view';
import { PortalFrame } from '../../portal-frame';

// Look at the dashboard on your own computer without signing in. Made-up figures, nothing is read or saved,
// and the page does not exist on the live site. (Under /signup so it is reachable while signed out.)
const APPS = [['attendance', 'HRIS'], ['finance', 'Finance'], ['marketing', 'Marketing'], ['stock', 'Stock Manager']].map(([key, name]) => ({ key, name, base_url: `/${key}` }));
const ORG: Org = { id: 'preview', name: 'Sample Motors', org_role: 'owner', verification_status: 'verified', verification_note: null, services: { attendance: 'admin', finance: 'admin', marketing: 'admin', stock: 'admin' } };

// A year of sample books, run through the same calculations as the real dashboard
function sample(now: Date): Raw {
  const raw: Raw = {
    txs: [], cl: [], vl: [], transfers: [],
    accounts: [{ id: 'current', name: 'Current account' }, { id: 'savings', name: 'Savings account' }],
    parties: [{ id: 'c1', name: 'Sample Traders' }, { id: 'c2', name: 'Sample Finance Co.' }, { id: 'c3', name: 'Sample Rentals' }, { id: 'v1', name: 'Sample Auto Parts' }],
    categories: [{ id: 'rent', name: 'Rent' }, { id: 'pay', name: 'Salaries' }, { id: 'power', name: 'Electricity' }],
  };
  for (let i = 11; i >= 0; i--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 10);
    const swing = 1 + ((i * 7) % 5) / 10;
    const tx = (type: 'sale' | 'purchase' | 'expense', amount: number, extra: Partial<Raw['txs'][number]> = {}) =>
      raw.txs.push({ id: `t${raw.txs.length}`, type, amount: Math.round(amount), customer_id: null, party_name: null, bill_date: date, created_at: date, bank_account_id: null, expense_category_id: null, ...extra });
    const entry = (list: Raw['cl'], party: 'customer_id' | 'vendor_id', id: string, entry_type: 'debit' | 'credit', amount: number) =>
      // customers pay into the bank; suppliers are paid in cash
      list.push({ id: `e${raw.cl.length + raw.vl.length}`, [party]: id, entry_type, amount: Math.round(amount), source: entry_type === 'debit' ? 'booking' : 'manual', bank_account_id: entry_type === 'credit' && party === 'customer_id' ? 'current' : null, entry_date: date, note: null, created_at: date });

    tx('sale', 900000 * swing, { party_name: 'Walk-in customer' });
    const buyer = ['c1', 'c2', 'c3'][i % 3];
    tx('sale', 420000 * swing, { customer_id: buyer });
    entry(raw.cl, 'customer_id', buyer, 'debit', 420000 * swing);
    entry(raw.cl, 'customer_id', buyer, 'credit', (i < 2 ? 150000 : 360000) * swing);
    tx('purchase', 640000 * swing, { customer_id: 'v1', party_name: 'Sample Auto Parts' });
    entry(raw.vl, 'vendor_id', 'v1', 'debit', 640000 * swing);
    entry(raw.vl, 'vendor_id', 'v1', 'credit', 560000 * swing);
    tx('expense', 180000, { expense_category_id: 'pay', party_name: 'Salaries' });
    tx('expense', 35000, { expense_category_id: 'rent', party_name: 'Rent' });
    tx('expense', 6400 * swing, { expense_category_id: 'power', party_name: 'Electricity', bank_account_id: 'savings' });
  }
  raw.transfers.push({ from_account_id: 'current', to_account_id: 'savings', amount: 250000 });
  return raw;
}

export default function DashboardPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  const now = new Date();
  const date = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'Asia/Kathmandu' }).format(now);
  return (
    <PortalFrame preview light org={ORG} orgs={[ORG]} services={APPS} person="Sample Owner" email="owner@example.com" page="home" phoneDate={date({ weekday: 'short', day: 'numeric', month: 'short' })}>
      <DashboardView
        orgName={ORG.name}
        today={date({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        access={ORG.services}
        isAdmin
        verification={{ status: 'verified', note: null }}
        d={computeDashboard(sample(now), now)}
        stock={{ vehicles: 42, lowParts: 5 }}
        trialLeft={5}
        message="Preview with made-up figures. Links to other pages need a signed-in account."
      />
    </PortalFrame>
  );
}
