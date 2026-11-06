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
      <h1>Welcome. Tell us about your business</h1>
      <p>A few questions so we can suggest the right services, then your organization's details. We verify every organization, so we need its details and the owner's.</p>
      <Notice error={error} />
      <Wizard key={error ?? ''} />
    </main>
  );
}
