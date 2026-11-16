// The business builder: what we ask, and which services the answers point to.
// Adding a service = one entry in SERVICE_LABELS plus the need that maps to it.

export const BUSINESS_TYPES = [
  { id: 'vehicles', label: 'Vehicle dealership', needs: ['stock', 'finance'] },
  { id: 'workshop', label: 'Repair and service workshop', needs: ['stock', 'finance'] },
  { id: 'retail', label: 'Retail or wholesale', needs: ['stock', 'finance'] },
  { id: 'services', label: 'Service or staffing company', needs: ['attendance', 'finance'] },
  { id: 'other', label: 'Other', needs: [] as string[] },
] as const;

// `service` is the core.services key a need points to; "other" only records demand
export const NEEDS = [
  { id: 'stock', label: 'Stock and sales', service: 'stock' },
  { id: 'attendance', label: 'Staff attendance and payroll', service: 'attendance' },
  { id: 'finance', label: 'Accounts and finance', service: 'finance' },
  { id: 'other', label: 'Something else', service: null },
] as const;

export const TEAM_SIZES = ['Just me', '2-5', '6-20', '20+'] as const;

export const SERVICE_LABELS: Record<string, string> = { stock: 'Auto Stock Manager', finance: 'Finance', attendance: 'Attendance Nepal' };

export type Profile = { business_type: string | null; business_needs: string[] | null; team_size: string | null };

export function recommend({ business_type, business_needs, team_size }: Profile): string[] {
  const keys = new Set<string>();
  for (const id of business_needs ?? []) {
    const service = NEEDS.find((n) => n.id === id)?.service;
    if (service) keys.add(service);
  }
  if (team_size === '6-20' || team_size === '20+') keys.add('attendance');
  if (business_type === 'vehicles') keys.add('stock');
  return Object.keys(SERVICE_LABELS).filter((k) => keys.has(k));
}

// Which Stock features suit each kind of business. Only a hint shown in Settings: nothing is switched on from here, the owner
// ticks what they want and asks, and platform staff approve (core.request_features). Warranty is already on for everyone.
const FEATURE_STARTERS: Record<string, string[]> = {
  vehicles: ['stock.vehicles', 'stock.sanakhat', 'stock.job_cards'],
  workshop: ['stock.job_cards', 'stock.spare_parts'],
};

export const suggestedFeatures = (business_type: string | null): string[] =>
  business_type && Object.hasOwn(FEATURE_STARTERS, business_type) ? FEATURE_STARTERS[business_type] : [];

// Form values are untrusted: keep only known answers
export function parseProfile(f: { get(k: string): unknown; getAll(k: string): unknown[] }): Profile {
  const one = (k: string, allowed: readonly string[]) => (allowed.includes(String(f.get(k))) ? String(f.get(k)) : null);
  const needs = NEEDS.map((n) => n.id as string).filter((id) => f.getAll('business_needs').includes(id));
  return {
    business_type: one('business_type', BUSINESS_TYPES.map((t) => t.id)),
    business_needs: needs.length ? needs : null,
    team_size: one('team_size', TEAM_SIZES),
  };
}
