import { Fragment } from 'react';
import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase';
import { updateProfile } from '../actions';
import { Notice, type Search } from '../notice';
import { Shell } from '../shell';

// Your account: who you are in this business and your role in each app, with a form to change your name and phone
export default async function Profile({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0] ?? null;
  const [{ data: profile }, { data: claims }, { data: services }] = await Promise.all([
    supabase.schema('core').from('profiles').select('phone').eq('user_id', ctx.user_id).maybeSingle(),
    supabase.auth.getClaims(),
    supabase.schema('core').from('services').select('key, name').eq('is_active', true).order('name'),
  ]);
  return (
    <Shell org={org} orgs={ctx.orgs} page="profile">
      <h1>Settings</h1>
      <Notice error={error} message={message} />
      <section className="tile">
        <h2>Account</h2>
        <dl>
          <dt>Email</dt><dd>{claims?.claims.email ?? '—'}</dd>
          {org && <><dt>Organization</dt><dd>{org.name}</dd><dt>Your role</dt><dd className="cap">{org.org_role}</dd></>}
          {org && services?.filter((s) => org.services[s.key]).map((s) => (
            <Fragment key={s.key}><dt>{s.name} role</dt><dd className="cap">{org.services[s.key]}</dd></Fragment>
          ))}
        </dl>
      </section>
      <section className="tile">
        <h2>Edit profile</h2>
        <form action={updateProfile}>
          <div className="grid2">
            <label>Full name<input name="full_name" defaultValue={ctx.full_name ?? ''} maxLength={120} autoComplete="off" required /></label>
            <label>Phone<input name="phone" type="tel" defaultValue={profile?.phone ?? ''} pattern="\+?[0-9][0-9 \-]{6,19}" title="Digits, optionally starting with +" autoComplete="off" /></label>
          </div>
          <button type="submit">Save</button>
        </form>
      </section>
    </Shell>
  );
}
