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
