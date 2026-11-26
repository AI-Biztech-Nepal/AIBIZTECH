import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient, getContext } from '@/lib/supabase';
import { TRIAL_DAYS } from '@/lib/signup';
import { AuthShell } from '../auth-shell';
import type { Search } from '../notice';
import { Wizard } from './wizard';

export const metadata: Metadata = { title: 'Set up your workspace · AIBIZTECH' };

export default async function Onboarding({ searchParams }: { searchParams: Search }) {
  const { error } = await searchParams;
  const { ctx } = await getContext().catch(() => ({ ctx: undefined }));
  if (ctx === null) redirect('/login');

  // Sign-up already collected these, so the wizard does not ask again
  const { data } = await (await createClient()).auth.getUser();
  const m = data.user?.user_metadata ?? {};
  const { data: services } = await (await createClient()).schema('core').from('services').select('key, name').eq('is_active', true).order('name');
  // The business name from sign-up belongs to the first business only
  const mine = { name: m.full_name || '', address: m.address ?? '', phone: m.phone ?? '', email: data.user?.email ?? '', business: ctx?.orgs.length ? '' : (m.business_name ?? '') };

  return (
    <AuthShell wide aside={`Your ${TRIAL_DAYS}-day free trial starts when you finish setup`}>
      <Wizard key={error ?? ''} initial={mine} services={services ?? []} another={!!ctx?.orgs.length} error={error} />
    </AuthShell>
  );
}
