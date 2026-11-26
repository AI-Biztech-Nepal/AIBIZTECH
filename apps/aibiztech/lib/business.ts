import type { Member } from './supabase.ts';

export type Enabled = { service_key: string; status: string; trial_ends_at: string; enabled_at: string };
export type Invite = { id: string; email: string; org_role: string; expires_at: string };
export type Alert = { text: string; bad?: boolean; href?: string; action?: string };

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
export const roleName = (role: string) => (role === 'hr' ? 'HR' : (role.charAt(0).toUpperCase() + role.slice(1)).replace(/_/g, ' '));

type About = {
  verification: { status: string; note: string | null };
  services: { key: string; name: string }[];
  enabled: Enabled[];
  members: Member[];
  pending: Invite[];
};

// What needs the owner's or admin's attention on the My Business page, most urgent first
export function businessAlerts({ verification, services, enabled, members, pending }: About, now = new Date()): Alert[] {
  const alerts: Alert[] = [];
  const team = { href: '/team', action: 'Open team' };
  const plans = { href: '/plans', action: 'View plans' };
  if (verification.status === 'pending') alerts.push({ text: 'Your business is awaiting verification. Apps unlock once it is verified.' });
  if (verification.status === 'rejected') alerts.push({ text: `Verification was rejected${verification.note ? `: ${verification.note}` : ''}. Contact support.`, bad: true });

  const active = members.filter((m) => m.status === 'active');
  for (const s of services) {
    const e = enabled.find((row) => row.service_key === s.key);
    if (!e) continue;
    const left = Math.ceil((new Date(e.trial_ends_at).getTime() - now.getTime()) / 864e5);
    if (e.status === 'trial' && left <= 0) alerts.push({ text: `${s.name} trial has ended. Subscribe to open it again.`, bad: true, ...plans });
    else if (e.status === 'trial' && left <= 3) alerts.push({ text: `${s.name} trial ends in ${plural(left, 'day')}.`, ...plans });
    if (e.status === 'suspended') alerts.push({ text: `${s.name} is suspended.`, bad: true });
    // A member list that could not be loaded must not read as "nobody has access"
    if (members.length && !active.some((m) => m.service_roles[s.key])) alerts.push({ text: `Nobody has a role in ${s.name} yet.`, href: '/team', action: 'Assign roles' });
  }

  const expired = pending.filter((i) => new Date(i.expires_at) <= now).length;
  if (expired) alerts.push({ text: `${plural(expired, 'invitation')} expired without being accepted.`, ...team });
  const disabled = members.length - active.length;
  if (disabled) alerts.push({ text: `${plural(disabled, 'member')} disabled and cannot sign in to apps.`, ...team });
  return alerts;
}
