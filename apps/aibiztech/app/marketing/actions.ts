'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMarketing } from '@/lib/marketing';

const text = (f: FormData, k: string) => { const v = String(f.get(k) ?? '').trim(); return v || null; };
const go = (path: string, kind: 'error' | 'message', msg: string): never => redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);
const now = () => new Date().toISOString();

const STATUSES = ['new', 'contacted', 'interested', 'converted', 'lost'];
const SOURCES = ['walk_in', 'website', 'facebook', 'tiktok', 'referral', 'other'];
const KINDS = ['call', 'visit', 'message', 'other'];

// ---- leads ----
export async function addLead(form: FormData) {
  const { db, org } = await getMarketing();
  const name = text(form, 'name'); const phone = text(form, 'phone');
  if (!name && !phone) go('/marketing/leads', 'error', 'Enter a name or a phone number.');
  const { error } = await db.from('leads').insert({
    id: randomUUID(), company_id: org.id, type: text(form, 'type') ?? 'enquiry', name, phone, email: text(form, 'email'), address: text(form, 'address'),
    message: text(form, 'message'), vehicle_type: text(form, 'vehicle_type'), status: 'new', created_at: now(),
  });
  if (error) go('/marketing/leads', 'error', error.message);
  go('/marketing/leads', 'message', 'Lead added.');
}

export async function acceptLead(form: FormData) {
  const { db } = await getMarketing();
  const { error } = await db.rpc('accept_lead', { p_lead: text(form, 'id') ?? '' });
  if (error) go('/marketing/leads', 'error', error.message);
  revalidatePath('/marketing');
  go('/marketing/leads', 'message', 'Lead accepted. The person is now in the CRM.');
}

export async function rejectLead(form: FormData) {
  const { db } = await getMarketing();
  const { error } = await db.rpc('reject_lead', { p_lead: text(form, 'id') ?? '', p_remark: text(form, 'remark') ?? '' });
  if (error) go('/marketing/leads', 'error', error.message);
  revalidatePath('/marketing');
  go('/marketing/leads', 'message', 'Lead rejected.');
}

// ---- CRM ----
export async function addPerson(form: FormData) {
  const { db, org } = await getMarketing();
  const name = text(form, 'name');
  if (!name) go('/marketing/crm', 'error', 'Name is required.');
  const source = text(form, 'source');
  const { error } = await db.from('customers').insert({
    id: randomUUID(), company_id: org.id, name, contact_number: text(form, 'contact_number'), address: text(form, 'address'),
    source: source && SOURCES.includes(source) ? source : null, lead_status: 'new', interested_vehicle: text(form, 'interested_vehicle'), notes: text(form, 'notes'), created_at: now(),
  });
  if (error) go('/marketing/crm', 'error', error.message);
  go('/marketing/crm', 'message', 'Person added to the CRM.');
}

export async function setStatus(form: FormData) {
  const { db, org } = await getMarketing();
  const status = text(form, 'lead_status') ?? '';
  if (!STATUSES.includes(status)) go('/marketing/crm', 'error', 'Unknown status.');
  const { error } = await db.from('customers').update({ lead_status: status }).eq('id', text(form, 'id') ?? '').eq('company_id', org.id);
  if (error) go('/marketing/crm', 'error', error.message);
  go('/marketing/crm', 'message', 'Status updated.');
}

export async function logInteraction(form: FormData) {
  const { db, org, ctx } = await getMarketing();
  const summary = text(form, 'summary');
  if (!summary) go('/marketing/crm', 'error', 'Write what was discussed.');
  const kind = text(form, 'kind') ?? 'call';
  const { error } = await db.from('crm_interactions').insert({
    id: randomUUID(), company_id: org.id, customer_id: text(form, 'id'), kind: KINDS.includes(kind) ? kind : 'other', summary, occurred_at: now(), created_by: ctx.full_name, created_at: now(),
  });
  if (error) go('/marketing/crm', 'error', error.message);
  go('/marketing/crm', 'message', 'Contact logged.');
}

export async function scheduleFollowup(form: FormData) {
  const { db, org, ctx } = await getMarketing();
  const due = text(form, 'due');
  if (!due) go('/marketing/crm', 'error', 'Choose the follow-up date.');
  const { error } = await db.from('crm_followups').insert({
    id: randomUUID(), company_id: org.id, customer_id: text(form, 'id'), due_at: due, purpose: text(form, 'purpose'), notes: text(form, 'notes'), status: 'pending',
    created_by: ctx.full_name, created_at: now(), updated_at: now(),
  });
  if (error) go('/marketing/crm', 'error', error.message);
  go('/marketing/crm', 'message', 'Follow-up scheduled.');
}

export async function completeFollowup(form: FormData) {
  const { db, org } = await getMarketing();
  const { error } = await db.from('crm_followups').update({ status: 'done', completed_at: now(), outcome: text(form, 'outcome'), updated_at: now() })
    .eq('id', text(form, 'id') ?? '').eq('company_id', org.id);
  if (error) go('/marketing/crm', 'error', error.message);
  revalidatePath('/marketing');
  go('/marketing/crm', 'message', 'Follow-up marked done.');
}
