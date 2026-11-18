'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getStock } from '@/lib/stock';

const text = (f: FormData, k: string) => { const v = String(f.get(k) ?? '').trim(); return v || null; };
const num = (f: FormData, k: string) => { const v = text(f, k); const n = v === null ? NaN : Number(v); return Number.isFinite(n) ? n : null; };
const back = (kind: 'error' | 'message', msg: string): never => redirect('/stock/inventory?' + kind + '=' + encodeURIComponent(msg));

export async function addVehicle(form: FormData) {
  const { stock, org } = await getStock();
  const brand = text(form, 'brand');
  const model = text(form, 'model');
  if (!brand || !model) back('error', 'Brand and model are required.');
  const now = new Date().toISOString();
  const { error } = await stock.from('vehicles').insert({
    id: randomUUID(), company_id: org.id, brand, model, variant: text(form, 'variant'), year: num(form, 'year'),
    registration_number: text(form, 'registration_number'), chassis_number: text(form, 'chassis_number'), color: text(form, 'color'),
    fuel_type: text(form, 'fuel_type'), vehicle_type: text(form, 'vehicle_type'), kilometer_run: num(form, 'kilometer_run'),
    purchase_price: num(form, 'purchase_price'), purchase_date: text(form, 'purchase_date'), selling_price: num(form, 'selling_price'),
    notes: text(form, 'notes'), status: 'available', created_at: now, updated_at: now,
  });
  if (error) back('error', error.message);
  revalidatePath('/stock');
  back('message', 'Vehicle added.');
}

export async function deleteVehicle(form: FormData) {
  const { stock, org } = await getStock();
  const id = text(form, 'id');
  if (!id) back('error', 'Missing vehicle.');
  const { error } = await stock.from('vehicles').delete().eq('id', id).eq('company_id', org.id);
  if (error) back('error', error.message);
  revalidatePath('/stock');
  back('message', 'Vehicle removed.');
}

// ---- customers, vendors, spare parts ----
const go = (path: string, kind: 'error' | 'message', msg: string): never => redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);

export async function addCustomer(form: FormData) {
  const { stock, org } = await getStock();
  const name = text(form, 'name');
  if (!name) go('/stock/customers', 'error', 'Name is required.');
  const { error } = await stock.from('customers').insert({
    id: randomUUID(), company_id: org.id, name, contact_number: text(form, 'contact_number'), address: text(form, 'address'),
    id_number: text(form, 'id_number'), occupation: text(form, 'occupation'), budget_min: num(form, 'budget_min'), budget_max: num(form, 'budget_max'),
    interested_brands: text(form, 'interested_brands'), notes: text(form, 'notes'), created_at: new Date().toISOString(),
  });
  if (error) go('/stock/customers', 'error', error.message);
  go('/stock/customers', 'message', 'Customer added.');
}

export async function deleteCustomer(form: FormData) {
  const { stock, org } = await getStock();
  const { error } = await stock.from('customers').delete().eq('id', text(form, 'id') ?? '').eq('company_id', org.id);
  if (error) go('/stock/customers', 'error', error.message);
  go('/stock/customers', 'message', 'Customer removed.');
}

export async function addVendor(form: FormData) {
  const { stock, org } = await getStock();
  const name = text(form, 'name');
  if (!name) go('/stock/vendors', 'error', 'Name is required.');
  const { error } = await stock.from('vendors').insert({
    id: randomUUID(), company_id: org.id, name, phone: text(form, 'phone'), address: text(form, 'address'), notes: text(form, 'notes'),
    vendor_type: text(form, 'vendor_type') ?? 'both', commission_amount: num(form, 'commission_amount'), created_at: new Date().toISOString(),
  });
  if (error) go('/stock/vendors', 'error', error.message);
  go('/stock/vendors', 'message', 'Vendor added.');
}

export async function deleteVendor(form: FormData) {
  const { stock, org } = await getStock();
  const { error } = await stock.from('vendors').delete().eq('id', text(form, 'id') ?? '').eq('company_id', org.id);
  if (error) go('/stock/vendors', 'error', error.message);
  go('/stock/vendors', 'message', 'Vendor removed.');
}

export async function addPart(form: FormData) {
  const { stock, org } = await getStock();
  const name = text(form, 'name');
  if (!name) go('/stock/spare-parts', 'error', 'Part name is required.');
  const now = new Date().toISOString();
  const quantity = Math.max(0, Math.trunc(num(form, 'quantity') ?? 0));
  const id = randomUUID();
  const { error } = await stock.from('spare_parts').insert({
    id, company_id: org.id, name, category: text(form, 'category'), brand_compatibility: text(form, 'brand_compatibility'),
    part_number: text(form, 'part_number'), quantity: 0, unit_cost: num(form, 'unit_cost'), selling_price: num(form, 'selling_price'),
    vendor_id: text(form, 'vendor_id'), min_stock_alert: num(form, 'min_stock_alert'), location: text(form, 'location'), notes: text(form, 'notes'),
    is_kit: false, stock_type: 'part', entry_date: now.slice(0, 10), created_at: now, updated_at: now,
  });
  if (error) go('/stock/spare-parts', 'error', error.message);
  // opening stock goes through the same step as any other stock-in, so it appears in the history
  if (quantity > 0) {
    const { error: e2 } = await stock.rpc('adjust_part', { p_part: id, p_type: 'in', p_qty: quantity, p_reason: 'Opening stock' });
    if (e2) go('/stock/spare-parts', 'error', e2.message);
  }
  go('/stock/spare-parts', 'message', 'Part added.');
}

export async function adjustPart(form: FormData) {
  const { stock } = await getStock();
  const type = text(form, 'type') === 'out' ? 'out' : 'in';
  const { error } = await stock.rpc('adjust_part', { p_part: text(form, 'id') ?? '', p_type: type, p_qty: Math.trunc(num(form, 'qty') ?? 0), p_reason: text(form, 'reason') });
  if (error) go('/stock/spare-parts', 'error', error.message);
  go('/stock/spare-parts', 'message', type === 'in' ? 'Stock added.' : 'Stock taken out.');
}

export async function deletePart(form: FormData) {
  const { stock, org } = await getStock();
  const { error } = await stock.from('spare_parts').delete().eq('id', text(form, 'id') ?? '').eq('company_id', org.id);
  if (error) go('/stock/spare-parts', 'error', error.message);
  go('/stock/spare-parts', 'message', 'Part removed.');
}

// ---- sales ----
export async function recordSale(form: FormData) {
  const { stock, org, ctx } = await getStock();
  const vehicle = text(form, 'vehicle_id');
  const price = num(form, 'sale_price');
  if (!vehicle || price === null) go('/stock/sales', 'error', 'Choose a vehicle and enter the sale price.');
  const extra = [1, 2, 3].map((i) => ({ name: text(form, `extra_name_${i}`), amount: num(form, `extra_amount_${i}`) })).filter((e) => e.name && e.amount).map((e) => ({ name: e.name, amount: e.amount }));
  const { error } = await stock.rpc('record_sale', {
    p_vehicle: vehicle, p_customer: text(form, 'customer_id') ?? '', p_sale_price: price, p_extra: extra, p_method: text(form, 'payment_method') ?? 'Cash',
    p_cash: num(form, 'paid_cash') ?? 0, p_bank: num(form, 'paid_bank') ?? 0, p_advance: num(form, 'advance_payment') ?? 0,
    p_exchange_value: num(form, 'exchange_valuation') ?? 0, p_exchange_brand: text(form, 'exchange_brand'), p_exchange_model: text(form, 'exchange_model'),
    p_exchange_reg: text(form, 'exchange_reg_no'), p_due_override: null, p_due_date: text(form, 'due_date') ?? '', p_sale_date: text(form, 'sale_date') ?? '',
    p_notes: text(form, 'notes'), p_witness_name: text(form, 'witness_name'), p_witness_address: text(form, 'witness_address'),
    p_witness_phone: text(form, 'witness_phone'), p_witness_id: text(form, 'witness_id_number'), p_sold_by: ctx.full_name,
  });
  void org;
  if (error) go('/stock/sales', 'error', error.message);
  revalidatePath('/stock');
  go('/stock/sales', 'message', 'Sale recorded. The vehicle is now marked sold.');
}

export async function receivePayment(form: FormData) {
  const { stock } = await getStock();
  const { error } = await stock.rpc('receive_sale_payment', { p_sale: text(form, 'id') ?? '', p_cash: num(form, 'cash') ?? 0, p_bank: num(form, 'bank') ?? 0 });
  if (error) go('/stock/sales', 'error', error.message);
  go('/stock/sales', 'message', 'Payment recorded.');
}

export async function deleteSale(form: FormData) {
  const { stock } = await getStock();
  const { error } = await stock.rpc('delete_sale', { p_sale: text(form, 'id') ?? '' });
  if (error) go('/stock/sales', 'error', error.message);
  revalidatePath('/stock');
  go('/stock/sales', 'message', 'Sale deleted. The vehicle is back in stock.');
}
