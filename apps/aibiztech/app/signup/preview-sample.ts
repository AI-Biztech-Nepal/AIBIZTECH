import type { Org } from '@/lib/supabase';
import type { AppRow } from '../plans/load';

// Made-up business for the local preview pages. Nothing here is read from or saved to the database.
export const APPS = [['attendance', 'HRIS'], ['finance', 'Finance'], ['marketing', 'Marketing'], ['stock', 'Stock Manager']].map(([key, name]) => ({ key, name, base_url: `/${key}` }));
export const ORG: Org = { id: 'preview', name: 'Sample Motors', org_role: 'owner', verification_status: 'verified', verification_note: null, services: { attendance: 'admin', finance: 'admin', marketing: 'admin', stock: 'admin' } };

// state: 'ended', 'active', 'new' (no apps); anything else is a trial on day 3
export function sampleRows(state: string | undefined, now: Date): AppRow[] {
  if (state === 'new') return [];
  const at = (days: number) => new Date(now.getTime() + days * 864e5).toISOString();
  const [startedAgo, endsIn] = state === 'ended' ? [9, -2] : [2, 5];
  const active = state === 'active';
  return APPS.map((a) => ({ service_key: a.key, name: a.name, status: active ? 'active' : 'trial', plan: active ? 'professional' : null, enabled_at: at(-startedAgo), trial_ends_at: at(endsIn) }));
}
