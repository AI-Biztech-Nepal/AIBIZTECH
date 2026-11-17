import { redirect } from 'next/navigation';
import { createClient, getContext } from '@/lib/supabase';
import { Notice, type Search } from '../notice';
import { Wizard } from './wizard';

export default async function Onboarding({ searchParams }: { searchParams: Search }) {
  const { error } = await searchParams;
  const { ctx } = await getContext().catch(() => ({ ctx: undefined }));
  if (ctx === null) redirect('/login');
  if (ctx?.orgs.length) redirect('/');

  // Sign-up already collected these, so the wizard does not ask again
  const { data } = await (await createClient()).auth.getUser();
  const m = data.user?.user_metadata ?? {};
  const mine = { name: m.company || m.full_name || '', address: m.address ?? '', phone: m.phone ?? '', email: data.user?.email ?? '' };

  return (
    <main className="card form">
      <h1>Set up your organization</h1>
      <p>Your business is the organization. We verify every organization, so we need its details and the owner's.</p>
      <Notice error={error} />
      <Wizard key={error ?? ''} initial={mine} />
    </main>
  );
}
