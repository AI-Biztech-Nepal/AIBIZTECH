import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getContext, type Member } from '@/lib/supabase';
import { createInvite, revokeInvite, saveMember } from '../actions';
import { Shell } from '../shell';
import { CopyLink } from './copy-link';
import { Notice, type Search } from '../notice';

export default async function Team({ searchParams }: { searchParams: Search }) {
  const { error, message, invite } = await searchParams;
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  if (!org) redirect('/onboarding');
  if (org.org_role === 'member') redirect('/');

  const core = supabase.schema('core');
  const [{ data: rows }, { data: services }, { data: enabled }, { data: pending }] = await Promise.all([
    core.rpc('org_members', { p_org: org.id }),
    core.from('services').select('key, name, roles').eq('is_active', true).order('name'),
    core.from('org_services').select('service_key').eq('org_id', org.id),
    core.from('invitations').select('id, email, org_role, expires_at').eq('org_id', org.id).is('accepted_at', null).order('expires_at'),
  ]);
  const h = await headers();
  const linkFor = (id: string) => `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}/invite/${id}`;
  const members = rows as Member[] | null;
  const enabledKeys = new Set((enabled ?? []).map((s) => s.service_key));
  const offered = (services ?? []).filter((s) => enabledKeys.has(s.key));

  return (
    <Shell org={org} orgs={ctx.orgs} page="team">

      <h1>Team</h1>
      <p>Choose each person's role in your organization and in each service you have enabled.</p>
      <Notice error={error} message={message} />

      {invite && (
        <section className="tile">
          <h2>Invitation created</h2>
          <p>Send this link to the person. It works once, for the email you entered, and expires in 7 days.</p>
          <CopyLink value={linkFor(invite)} />
        </section>
      )}

      <section className="tile">
        <h2>Invite someone</h2>
        <form action={createInvite}>
          <input type="hidden" name="org_id" value={org.id} />
          <div className="grid2">
            <label>Email<input name="email" type="email" autoComplete="off" required /></label>
            <label>Organization role
              <select name="org_role" defaultValue="member"><option value="member">Member</option><option value="admin">Admin</option></select>
            </label>
            {offered.map((s) => (
              <label key={s.key}>{s.name}
                <select name={`role_${s.key}`} defaultValue="">
                  <option value="">No access</option>
                  {s.roles.map((r: string) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            ))}
          </div>
          <button>Create invitation</button>
        </form>
      </section>

      {!!pending?.length && (
        <section className="tile">
          <h2>Pending invitations</h2>
          <ul className="notes">
            {pending.map((i) => (
              <li key={i.id}>
                <strong>{i.email}</strong>
                <span>{i.org_role} · {new Date(i.expires_at) <= new Date() ? 'expired' : `expires ${new Date(i.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kathmandu' })}`}</span>
                <CopyLink value={linkFor(i.id)} />
                <form action={revokeInvite} className="inline"><input type="hidden" name="id" value={i.id} /><button className="link">Revoke</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="spaced">Members</h2>
      <ul className="members">
        {members?.map((m) => {
          const isOwner = m.org_role === 'owner';
          const isSelf = m.user_id === ctx.user_id;
          const manage = !isOwner && !isSelf;
          return (
            <li key={m.user_id} className="tile">
              <h2>{m.full_name || m.email}{isSelf && ' (you)'}</h2>
              <p>{m.email} · joined {new Date(m.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kathmandu' })}</p>
              <form action={saveMember}>
                <input type="hidden" name="org_id" value={org.id} />
                <input type="hidden" name="user_id" value={m.user_id} />
                {manage && <input type="hidden" name="manage" value="1" />}
                <div className="grid2">
                  <label>Organization role
                    {manage ? (
                      <select name="org_role" defaultValue={m.org_role}><option value="member">Member</option><option value="admin">Admin</option></select>
                    ) : (
                      <input value={m.org_role} readOnly />
                    )}
                  </label>
                  {manage && <label className="check"><input type="checkbox" name="active" defaultChecked={m.status === 'active'} /> Active (can sign in to services)</label>}
                  {!manage && m.status !== 'active' && <p className="error">Disabled</p>}
                  {offered.map((s) => (
                    <label key={s.key}>{s.name}
                      <select name={`role_${s.key}`} defaultValue={m.service_roles[s.key] ?? ''}>
                        <option value="">No access</option>
                        {s.roles.map((r: string) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                {!offered.length && !manage ? null : <button>Save</button>}
              </form>
            </li>
          );
        })}
      </ul>
      {!offered.length && <p>No services are enabled yet. Start a trial from the home page, then assign roles here.</p>}
    </Shell>
  );
}
