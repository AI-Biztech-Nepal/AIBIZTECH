'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getStock } from '@/lib/stock';
import { editFields, parseFieldLines, readAttributes, slugify, type ItemField } from '@/lib/items';
import { DEFAULT_WARRANTY_DAYS, emiPlan, warrantyInfo } from '@/lib/stock-calc';

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

// ---- EMI ----
export async function createEmi(form: FormData) {
  const { stock, org } = await getStock();
  if (org.services.stock !== 'admin') go('/stock/emi', 'error', 'Only a Stock Manager admin can use EMI.');
  const loan = num(form, 'loan_amount'); const months = num(form, 'tenure_months'); const rate = num(form, 'interest_rate') ?? 0;
  if (!loan || loan <= 0 || !months || months < 1) go('/stock/emi', 'error', 'Enter the loan amount and the number of months.');
  const plan = emiPlan(loan!, rate, months!);
  const customerId = text(form, 'customer_id'); const vehicleId = text(form, 'vehicle_id');
  const [{ data: c }, { data: v }] = await Promise.all([
    customerId ? stock.from('customers').select('name, contact_number').eq('id', customerId).maybeSingle() : Promise.resolve({ data: null }),
    vehicleId ? stock.from('vehicles').select('brand, model, year').eq('id', vehicleId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const { error } = await stock.from('emi_records').insert({
    id: randomUUID(), company_id: org.id, customer_id: customerId, vehicle_id: vehicleId, loan_amount: loan, down_payment: num(form, 'down_payment') ?? 0,
    interest_rate: rate, tenure_months: Math.trunc(months!), start_date: text(form, 'start_date'), financer_name: text(form, 'financer_name'), notes: text(form, 'notes'),
    monthly_installment: plan.monthly, total_payable: plan.totalPayable, total_interest: plan.totalInterest, status: 'active', created_at: new Date().toISOString(),
    customer_name: c?.name ?? null, customer_phone: c?.contact_number ?? null, vehicle_name: v ? [v.brand, v.model, v.year].filter(Boolean).join(' ') : null,
  });
  if (error) go('/stock/emi', 'error', error.message);
  go('/stock/emi', 'message', 'EMI plan created.');
}

export async function addEmiPayment(form: FormData) {
  const { stock, org, ctx } = await getStock();
  if (org.services.stock !== 'admin') go('/stock/emi', 'error', 'Only a Stock Manager admin can use EMI.');
  const amount = num(form, 'amount');
  if (!amount || amount <= 0) go('/stock/emi', 'error', 'Enter the amount paid.');
  const { error } = await stock.from('emi_payments').insert({
    id: randomUUID(), company_id: org.id, emi_id: text(form, 'emi_id'), amount, payment_date: text(form, 'payment_date') ?? new Date().toISOString().slice(0, 10),
    notes: text(form, 'notes'), recorded_by: ctx.full_name, created_at: new Date().toISOString(),
  });
  if (error) go('/stock/emi', 'error', error.message);
  go('/stock/emi', 'message', 'Payment recorded.');
}

// ---- job cards ----
export async function createJob(form: FormData) {
  const { stock, org } = await getStock();
  const external = text(form, 'kind') === 'external';
  const vehicleId = external ? null : text(form, 'vehicle_id');
  if (!external && !vehicleId) go('/stock/jobs', 'error', 'Choose a vehicle.');
  let isWarranty = false; let afterSale = false; let brand = text(form, 'vehicle_brand'); let model = text(form, 'vehicle_model');
  let year = num(form, 'vehicle_year'); let reg = text(form, 'registration_number');
  if (vehicleId) {
    const { data: v } = await stock.from('vehicles').select('brand, model, year, registration_number, status, sold_date, warranty_days, warranty_void').eq('id', vehicleId).eq('company_id', org.id).maybeSingle();
    if (!v) go('/stock/jobs', 'error', 'Vehicle not found.');
    ({ brand, model, registration_number: reg } = { brand: v!.brand, model: v!.model, registration_number: v!.registration_number });
    year = v!.year;
    if (v!.status === 'sold') {
      const [{ data: jobs }, { data: s }] = await Promise.all([
        stock.from('job_cards').select('is_warranty, after_sale, job_date, created_at').eq('vehicle_id', vehicleId!),
        stock.from('settings').select('warranty_days_default').eq('company_id', org.id).maybeSingle(),
      ]);
      afterSale = true;
      const w = warrantyInfo(v!, s?.warranty_days_default || DEFAULT_WARRANTY_DAYS, jobs ?? []);
      isWarranty = w.status === 'awaiting' || w.status === 'active';
    }
  }
  const parts: { part_id: string; part_name: string; quantity: number; unit_price: number | null }[] = [];
  for (const i of [1, 2, 3]) {
    const id = text(form, `part_${i}`); const qty = Math.trunc(num(form, `qty_${i}`) ?? 0);
    if (!id || qty <= 0) continue;
    const { data: p } = await stock.from('spare_parts').select('name, selling_price').eq('id', id).eq('company_id', org.id).maybeSingle();
    if (p) parts.push({ part_id: id, part_name: p.name ?? '', quantity: qty, unit_price: p.selling_price });
  }
  const { error } = await stock.rpc('create_job_card', {
    p_company: org.id, p_vehicle: vehicleId ?? '', p_brand: brand, p_model: model, p_year: year, p_reg: reg, p_customer: text(form, 'customer_name'),
    p_contact: text(form, 'customer_contact'), p_work: text(form, 'work_description'), p_mechanic: text(form, 'mechanic_name'),
    p_estimated: num(form, 'estimated_cost'), p_labour: num(form, 'labour_charge') ?? 0, p_date: text(form, 'job_date') ?? '', p_notes: text(form, 'notes'),
    p_parts: parts, p_is_warranty: isWarranty, p_after_sale: afterSale,
  });
  if (error) go('/stock/jobs', 'error', error.message);
  revalidatePath('/stock');
  go('/stock/jobs', 'message', isWarranty ? 'Job card opened as a warranty service (labour is free).' : 'Job card opened.');
}

export async function setJobStatus(form: FormData) {
  const { stock } = await getStock();
  const { error } = await stock.rpc('set_job_status', { p_job: text(form, 'id') ?? '', p_status: text(form, 'status') ?? '', p_actual: num(form, 'actual_cost') });
  if (error) go('/stock/jobs', 'error', error.message);
  revalidatePath('/stock');
  go('/stock/jobs', 'message', 'Job card updated.');
}

export async function deleteJob(form: FormData) {
  const { stock, org } = await getStock();
  if (org.services.stock !== 'admin') go('/stock/jobs', 'error', 'Only a Stock Manager admin can delete a job card.');
  const { error } = await stock.from('job_cards').delete().eq('id', text(form, 'id') ?? '').eq('company_id', org.id);
  if (error) go('/stock/jobs', 'error', error.message);
  go('/stock/jobs', 'message', 'Job card deleted.');
}

// ---- warranty ----
export async function voidWarranty(form: FormData) {
  const { stock, org, ctx } = await getStock();
  const reason = text(form, 'reason');
  if (!reason) go('/stock/warranty', 'error', 'Write the reason (for example: serviced outside the shop).');
  const now = new Date().toISOString();
  const { error } = await stock.from('vehicles').update({ warranty_void: true, warranty_void_reason: reason, warranty_voided_at: now, warranty_voided_by: ctx.full_name, updated_at: now })
    .eq('id', text(form, 'id') ?? '').eq('company_id', org.id).eq('status', 'sold');
  if (error) go('/stock/warranty', 'error', error.message);
  go('/stock/warranty', 'message', 'Warranty voided.');
}

export async function restoreWarranty(form: FormData) {
  const { stock, org } = await getStock();
  if (org.services.stock !== 'admin') go('/stock/warranty', 'error', 'Only a Stock Manager admin can restore a warranty.');
  const { error } = await stock.from('vehicles').update({ warranty_void: false, warranty_void_reason: null, warranty_voided_at: null, warranty_voided_by: null, updated_at: new Date().toISOString() })
    .eq('id', text(form, 'id') ?? '').eq('company_id', org.id).eq('status', 'sold');
  if (error) go('/stock/warranty', 'error', error.message);
  go('/stock/warranty', 'message', 'Warranty restored.');
}

export async function setWarrantyLength(form: FormData) {
  const { stock, org } = await getStock();
  if (org.services.stock !== 'admin') go('/stock/warranty', 'error', 'Only a Stock Manager admin can change the warranty length.');
  const days = num(form, 'days');
  const { error } = await stock.from('vehicles').update({ warranty_days: days && days > 0 ? Math.trunc(days) : null, updated_at: new Date().toISOString() })
    .eq('id', text(form, 'id') ?? '').eq('company_id', org.id).eq('status', 'sold');
  if (error) go('/stock/warranty', 'error', error.message);
  go('/stock/warranty', 'message', 'Warranty length updated.');
}

// ---- sanakhat (ownership termination) ----
export async function setSanakhat(form: FormData) {
  const { stock, org } = await getStock();
  const done = text(form, 'done') === '1';
  const date = text(form, 'date');
  if (done && date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) go('/stock/sanakhat', 'error', 'Date must look like 2026-11-06.');
  const { error } = await stock.from('vehicles').update(done
    ? { ownership_termination_status: 'yes', sanakhat_date: date ?? new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() }
    : { ownership_termination_status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', text(form, 'id') ?? '').eq('company_id', org.id);
  if (error) go('/stock/sanakhat', 'error', error.message);
  go('/stock/sanakhat', 'message', done ? 'Sanakhat marked done.' : 'Marked as not done.');
}

// ---- items: anything that is not a vehicle or a spare part. Each business makes its own categories (and the extra fields each
// category asks for); an item with a photo, a selling price and a category is published on the business's website by itself. ----
const ITEM_PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const itemsBack = (cat: string | null, kind: 'error' | 'message', msg: string): never =>
  redirect(`/stock/items?${cat ? `cat=${encodeURIComponent(cat)}&` : ''}${kind}=${encodeURIComponent(msg)}`);

export async function addItemCategory(form: FormData) {
  const { stock, org } = await getStock();
  const name = text(form, 'name');
  if (!name) itemsBack(null, 'error', 'Category name is required.');
  const website_key = slugify(text(form, 'website_key') ?? name!);
  if (!website_key) itemsBack(null, 'error', 'The website word needs letters or numbers.');
  const id = randomUUID();
  const { error } = await stock.from('item_categories').insert({ id, company_id: org.id, name: name!.slice(0, 100), website_key: website_key.slice(0, 60), fields: parseFieldLines(String(form.get('fields') ?? '')) });
  if (error) itemsBack(null, 'error', error.code === '23505' ? 'You already have a category with that website word.' : error.message);
  itemsBack(id, 'message', 'Category added.');
}

export async function updateItemCategory(form: FormData) {
  const { stock, org } = await getStock();
  const id = text(form, 'id') ?? '';
  const name = text(form, 'name');
  if (!name) itemsBack(id, 'error', 'Category name is required.');
  const website_key = slugify(text(form, 'website_key') ?? name!);
  if (!website_key) itemsBack(id, 'error', 'The website word needs letters or numbers.');
  const { data: cat } = await stock.from('item_categories').select('fields').eq('id', id).eq('company_id', org.id).maybeSingle();
  if (!cat) itemsBack(null, 'error', 'Category not found.');
  const edits = form.getAll('fkey').map((k, n) => {
    const key = String(k);
    return { key, label: String(form.getAll('flabel')[n] ?? ''), long: form.get('flong_' + key) === 'on', remove: form.get('fremove_' + key) === 'on' };
  });
  const fields = editFields((cat!.fields ?? []) as ItemField[], edits, String(form.get('fields') ?? ''));
  const { error } = await stock.from('item_categories').update({ name: name!.slice(0, 100), website_key: website_key.slice(0, 60), fields }).eq('id', id).eq('company_id', org.id);
  if (error) itemsBack(id, 'error', error.code === '23505' ? 'You already have a category with that website word.' : error.message);
  itemsBack(id, 'message', 'Category saved.');
}

export async function deleteItemCategory(form: FormData) {
  const { stock, org } = await getStock();
  const { error } = await stock.from('item_categories').delete().eq('id', text(form, 'id') ?? '').eq('company_id', org.id);
  if (error) itemsBack(text(form, 'id'), 'error', error.code === '23503' ? 'Remove the items in this category first.' : error.message);
  itemsBack(null, 'message', 'Category removed.');
}

// up to three photos from the form fields photo, photo2, photo3; returns their public addresses (stops with a message if one is bad)
async function uploadItemPhotos(supabase: Awaited<ReturnType<typeof getStock>>['supabase'], orgId: string, id: string, form: FormData, taken: number, cat: string | null): Promise<string[]> {
  const urls: string[] = [];
  for (const field of ['photo', 'photo2', 'photo3']) {
    const photo = form.get(field);
    if (!(photo instanceof File) || photo.size === 0) continue;
    const ext = ITEM_PHOTO_TYPES[photo.type];
    if (!ext) itemsBack(cat, 'error', 'Photos must be JPG, PNG or WebP images.');
    if (photo.size > 2 * 1024 * 1024) itemsBack(cat, 'error', 'Each photo must be under 2 MB.');
    const path = `${orgId}/${id}-${taken + urls.length + 1}.${ext}`;
    const { error } = await supabase.storage.from('item-photos').upload(path, photo, { contentType: photo.type });
    if (error) itemsBack(cat, 'error', error.message);
    urls.push(supabase.storage.from('item-photos').getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

// An item is saved with whatever is known. It appears on the website by itself as soon as it has a photo and a selling price;
// until then the list says what is missing.
export async function addItem(form: FormData) {
  const { supabase, stock, org } = await getStock();
  const cat = text(form, 'category_id');
  const name = text(form, 'name');
  if (!name) itemsBack(cat, 'error', 'Item name is required.');
  const { data: category } = await stock.from('item_categories').select('id, fields').eq('id', cat ?? '').eq('company_id', org.id).maybeSingle();
  if (!category) itemsBack(null, 'error', 'Pick a category first.');
  const id = randomUUID();
  const urls = await uploadItemPhotos(supabase, org.id, id, form, 0, cat);
  const price = num(form, 'selling_price');
  const { error } = await stock.from('items').insert({
    id, company_id: org.id, category_id: category!.id, name, selling_price: price, original_price: num(form, 'original_price'),
    quantity: Math.max(0, Math.trunc(num(form, 'quantity') ?? 0)), image_url: urls[0] ?? null, extra_images: urls.slice(1), description: text(form, 'description'),
    attributes: readAttributes((category!.fields ?? []) as ItemField[], (n) => String(form.get(n) ?? '')),
  });
  if (error) itemsBack(cat, 'error', error.message);
  itemsBack(cat, 'message', urls[0] && (price ?? 0) > 0 ? 'Item added and now on the website.' : 'Item added. It will go on the website once it has a photo and a selling price.');
}

// fill in what an item was missing: a selling price and/or a photo (the first photo becomes the main one if there is none yet)
export async function completeItem(form: FormData) {
  const { supabase, stock, org } = await getStock();
  const id = text(form, 'id') ?? '';
  const { data: it } = await stock.from('items').select('image_url, extra_images, category_id').eq('id', id).eq('company_id', org.id).maybeSingle();
  if (!it) itemsBack(null, 'error', 'Item not found.');
  const have = (it!.image_url ? 1 : 0) + (it!.extra_images?.length ?? 0);
  const urls = await uploadItemPhotos(supabase, org.id, id, form, have + 10, it!.category_id); // +10 keeps new file names apart from old ones
  const price = num(form, 'selling_price');
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (price !== null && price >= 0) patch.selling_price = price;
  if (urls.length) {
    if (it!.image_url) patch.extra_images = [...(it!.extra_images ?? []), ...urls];
    else { patch.image_url = urls[0]; patch.extra_images = [...(it!.extra_images ?? []), ...urls.slice(1)]; }
  }
  const { error } = await stock.from('items').update(patch).eq('id', id).eq('company_id', org.id);
  if (error) itemsBack(it!.category_id, 'error', error.message);
  itemsBack(it!.category_id, 'message', 'Item updated.');
}

export async function setItemQuantity(form: FormData) {
  const { stock, org } = await getStock();
  const { error } = await stock.from('items').update({ quantity: Math.max(0, Math.trunc(num(form, 'quantity') ?? 0)), updated_at: new Date().toISOString() }).eq('id', text(form, 'id') ?? '').eq('company_id', org.id);
  itemsBack(text(form, 'cat'), error ? 'error' : 'message', error ? error.message : 'Quantity saved.');
}

export async function deleteItem(form: FormData) {
  const { stock, org } = await getStock();
  const { error } = await stock.from('items').delete().eq('id', text(form, 'id') ?? '').eq('company_id', org.id);
  itemsBack(text(form, 'cat'), error ? 'error' : 'message', error ? error.message : 'Item removed.');
}

// the per-business switch for the vehicle parts of Stock Manager (admins only; the database checks too)
export async function setSellsVehicles(form: FormData) {
  const { stock, org } = await getStock();
  const on = text(form, 'on') === '1';
  const { error } = await stock.rpc('set_sells_vehicles', { p_org: org.id, p_value: on });
  if (error) itemsBack(null, 'error', error.message);
  redirect(on ? '/stock?message=' + encodeURIComponent('Vehicle features are on.') : '/stock/items?message=' + encodeURIComponent('Vehicle features are off for this business.'));
}
