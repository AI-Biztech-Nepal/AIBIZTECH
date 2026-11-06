import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from './supabase';

// One check per request. The database functions refuse non-staff themselves; this keeps the console's existence private.
export const isPlatformAdmin = cache(async () => {
  const { data } = await (await createClient()).schema('core').rpc('is_platform_admin');
  return data === true;
});

export async function platformClient() {
  if (!(await isPlatformAdmin())) notFound();
  return createClient();
}

const MS = { hour: 36e5, day: 864e5 };

export function ago(d: string) {
  const age = Date.now() - new Date(d).getTime();
  if (age < MS.hour) return 'just now';
  if (age < MS.day) return `${Math.floor(age / MS.hour)}h ago`;
  const days = Math.floor(age / MS.day);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kathmandu' });
