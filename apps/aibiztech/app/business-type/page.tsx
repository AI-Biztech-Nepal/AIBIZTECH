import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BUSINESS_TYPES } from '@/lib/business-kind';
import { businessKind } from '@/lib/business-kind-load';
import { getContext } from '@/lib/supabase';
import { setBusinessType } from '../actions';
import { Notice, type Search } from '../notice';
import { Shell } from '../shell';

export const metadata: Metadata = { title: 'Your kind of business · AIBIZTECH' };

// Asked once of an owner or admin whose business has nothing recorded: it picks the stock and finance screens
export default async function BusinessTypePage({ searchParams }: { searchParams: Search }) {
  const { error } = await searchParams;
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  if (!org) redirect('/onboarding');
  if (org.org_role === 'member' || (await businessKind(supabase, org.id))) redirect('/');

  return (
    <Shell org={org} orgs={ctx.orgs} page="home" light>
      <h1>What kind of business is {org.name}?</h1>
      <p>This sets your stock and finance screens. You can change it later in My Business.</p>
      <Notice error={error} />
      <section className="tile">
        <form action={setBusinessType}>
          <input type="hidden" name="org_id" value={org.id} />
          {BUSINESS_TYPES.map((t) => (
            <label key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0' }}>
              <input type="radio" name="business_type" value={t.id} required style={{ width: 'auto' }} />{t.label}
            </label>
          ))}
          <button type="submit">Continue</button>
        </form>
      </section>
    </Shell>
  );
}
