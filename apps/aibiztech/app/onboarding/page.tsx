import { redirect } from 'next/navigation';
import { createClient, getContext } from '@/lib/supabase';
import { Notice, type Search } from '../notice';
import { Wizard } from './wizard';

export default async function Onboarding({ searchParams }: { searchParams: Search }) {
  const { error } = await searchParams;
  const { ctx } = await getContext().catch(() => ({ ctx: undefined }));
  if (ctx === null) redirect('/login');

  // Sign-up already collected these, so the wizard does not ask again
  const { data } = await (await createClient()).auth.getUser();
  const m = data.user?.user_metadata ?? {};
  const { data: services } = await (await createClient()).schema('core').from('services').select('key, name').eq('is_active', true).order('name');
  const mine = { name: m.full_name || '', address: m.address ?? '', phone: m.phone ?? '', email: data.user?.email ?? '' };

  return (
    <main className="card form">
      <h1>{ctx?.orgs.length ? 'Add another business' : 'Set up your organization'}</h1>
      <p>Each business is its own organization with its own apps, team and PAN.</p>
      <Notice error={error} />
      <Wizard key={error ?? ''} initial={mine} services={services ?? []} />
    </main>
  );
}
