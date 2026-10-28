import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase';
import { Notice, type Search } from '../notice';
import { Wizard } from './wizard';

export default async function Onboarding({ searchParams }: { searchParams: Search }) {
  const { error } = await searchParams;
  const { ctx } = await getContext().catch(() => ({ ctx: undefined }));
  if (ctx === null) redirect('/login');
  if (ctx?.orgs.length) redirect('/');

  return (
    <main className="card form">
      <h1>Set up your organization</h1>
      <p>Your business is the organization. We verify every organization, so we need its details and the owner's.</p>
      <Notice error={error} />
      <Wizard key={error ?? ''} />
    </main>
  );
}
