// Stock Manager rules that are plain arithmetic, kept apart from the screens so they can be tested.

// Monthly instalment: P*r*(1+r)^n / ((1+r)^n - 1), r = yearly rate / 12; no interest means loan / months
export function emiPlan(loan: number, yearlyRatePct: number, months: number) {
  if (!(loan > 0) || !(months > 0)) return { monthly: 0, totalPayable: 0, totalInterest: 0 };
  const r = yearlyRatePct / 100 / 12;
  const monthly = r > 0 ? (loan * r * (1 + r) ** months) / ((1 + r) ** months - 1) : loan / months;
  return { monthly: round2(monthly), totalPayable: round2(monthly * months), totalInterest: round2(monthly * months - loan) };
}
export const round2 = (n: number) => Math.round(n * 100) / 100;

export const DEFAULT_WARRANTY_DAYS = 182; // about 6 months

export type WarrantyStatus = 'awaiting' | 'active' | 'expired' | 'void' | 'none';
type WVehicle = { status: string | null; sold_date: string | null; warranty_days: number | null; warranty_void: boolean | null };
type WJob = { is_warranty: boolean | null; after_sale: boolean | null; job_date: string | null; created_at: string | null };
const jobDay = (j: WJob) => (j.job_date || j.created_at || '').slice(0, 10);

// Jobs at the shop since the sale (the vehicle's 1st, 2nd... service)
export const postSaleJobs = (v: WVehicle, jobs: WJob[]) => {
  const sold = (v.sold_date ?? '').slice(0, 10);
  if (v.status !== 'sold' || !sold) return [];
  return jobs.filter((j) => (j.is_warranty || j.after_sale) && jobDay(j) >= sold).sort((a, b) => jobDay(a).localeCompare(jobDay(b)));
};

// The window runs from the sale date; it only turns active once the vehicle has had its 1st service at the shop
export function warrantyInfo(v: WVehicle, defaultDays: number, jobs: WJob[], today = new Date().toISOString().slice(0, 10)) {
  const days = v.warranty_days || defaultDays;
  const services = postSaleJobs(v, jobs).length;
  const info = { days, start: null as string | null, end: null as string | null, daysLeft: null as number | null, status: 'none' as WarrantyStatus, services };
  const sold = (v.sold_date ?? '').slice(0, 10);
  if (v.status !== 'sold' || !/^\d{4}-\d{2}-\d{2}$/.test(sold)) return info;
  const start = new Date(sold + 'T00:00:00Z');
  const end = new Date(start.getTime() + days * 86400000);
  info.start = sold;
  info.end = end.toISOString().slice(0, 10);
  info.daysLeft = Math.round((end.getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86400000);
  info.status = v.warranty_void ? 'void' : info.daysLeft < 0 ? 'expired' : services ? 'active' : 'awaiting';
  return info;
}
