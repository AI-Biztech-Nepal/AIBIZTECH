import { npr } from './books.ts';
import { TRIAL_DAYS } from './signup.ts';

export type Cycle = 'monthly' | 'yearly';
export type PlanKey = 'trial' | 'basic' | 'professional' | 'enterprise';
export type Plan = { key: PlanKey; name: string; about: string; price: Record<Cycle, number | null> | 'custom'; recommended?: boolean };

// shortcut: the one place prices live until the platform can manage them from the database.
// null means "not announced yet". Never put a made-up figure here.
export const PLANS: Plan[] = [
  { key: 'trial', name: 'Free Trial', about: `${TRIAL_DAYS} days to explore every module. No payment to start.`, price: { monthly: 0, yearly: 0 } },
  { key: 'basic', name: 'Basic', about: 'For small businesses starting their digital journey.', price: { monthly: null, yearly: null } },
  { key: 'professional', name: 'Professional', about: 'For growing businesses that need the complete tools.', price: { monthly: null, yearly: null }, recommended: true },
  { key: 'enterprise', name: 'Enterprise', about: 'For several branches and advanced requirements.', price: 'custom' },
];

// One value per plan, in the order above. true / false = included or not; null = not decided yet.
export type Cell = string | boolean | null;
export const COMPARISON: { group: string; rows: [string, Cell, Cell, Cell, Cell][] }[] = [
  { group: 'Modules and people', rows: [
    ['Attendance', true, true, 'Advanced', 'Advanced'],
    ['Finance', true, 'Basic', 'Complete', 'Complete'],
    ['Stock management', true, 'Basic', 'Advanced', 'Advanced'],
    ['Team members', null, 'Limited', 'Higher limit', 'Custom'],
  ] },
  { group: 'Reports and data', rows: [
    ['Reports', null, 'Standard', 'Detailed', 'Custom'],
    ['Data export', null, false, true, true],
    ['Advanced analytics', false, false, false, true],
  ] },
  { group: 'Control and support', rows: [
    ['Multiple branches', false, false, false, true],
    ['Advanced user permissions', false, false, false, true],
    ['Custom integrations', false, false, false, true],
    ['Support', null, 'Standard', 'Priority', 'Dedicated'],
  ] },
];

export function priceText(plan: Plan, cycle: Cycle): { amount: string; per: string } {
  if (plan.key === 'trial') return { amount: npr(0), per: `for ${TRIAL_DAYS} days` };
  if (plan.price === 'custom') return { amount: 'Custom', per: 'quoted for your business' };
  const n = plan.price[cycle];
  if (n === null) return { amount: 'To be announced', per: `billed ${cycle}` };
  return { amount: npr(n), per: cycle === 'monthly' ? 'per month' : 'per year' };
}

// ---- where a business stands, from its apps' rows in core.org_services ----
export type Access = { status: string; trial_ends_at: string; enabled_at: string };
export type Subscription =
  | { kind: 'none' }
  | { kind: 'active' }
  | { kind: 'ended'; ended: Date }
  | { kind: 'trial'; started: Date; ends: Date; day: number; days: number; left: number };

// Can the business use this app right now?
export const isOpen = (row: Access, now = new Date()) => row.status === 'active' || (row.status === 'trial' && new Date(row.trial_ends_at) > now);

const DAY = 864e5;
const daysUntil = (end: Date, now: Date) => Math.ceil((end.getTime() - now.getTime()) / DAY);
export const nepalDate = (d: Date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kathmandu' }).format(d);

// Apps can have different trial dates; the one ending soonest is the one to warn about
export function subscription(rows: Access[], now = new Date()): Subscription {
  if (rows.some((r) => r.status === 'active')) return { kind: 'active' };
  const trials = rows.filter((r) => r.status === 'trial').map((r) => ({ started: new Date(r.enabled_at), ends: new Date(r.trial_ends_at) }));
  const next = trials.filter((t) => t.ends > now).sort((a, b) => a.ends.getTime() - b.ends.getTime())[0];
  if (next) {
    const days = Math.max(1, Math.round((next.ends.getTime() - next.started.getTime()) / DAY));
    const left = daysUntil(next.ends, now);
    return { kind: 'trial', ...next, days, left, day: Math.min(days, Math.max(1, days - left + 1)) };
  }
  if (trials.length) return { kind: 'ended', ended: new Date(Math.max(...trials.map((t) => t.ends.getTime()))) };
  return { kind: 'none' };
}

export function appStatus(row: Access, now = new Date()): { text: string; tone: 'good' | 'warn' | 'bad' } {
  if (row.status === 'active') return { text: 'Active', tone: 'good' };
  if (row.status !== 'trial') return { text: 'Suspended', tone: 'bad' };
  const ends = new Date(row.trial_ends_at);
  if (ends <= now) return { text: `Trial ended ${nepalDate(ends)}`, tone: 'bad' };
  const left = daysUntil(ends, now);
  return { text: `Trial, ${left} ${left === 1 ? 'day' : 'days'} left`, tone: left <= 3 ? 'warn' : 'good' };
}

// An email address, phone number or web address, as a link
export function contactHref(contact: string): string {
  if (/^https?:\/\//i.test(contact)) return contact;
  if (contact.includes('@')) return `mailto:${contact}`;
  return `tel:${contact.replace(/[^\d+]/g, '')}`;
}
