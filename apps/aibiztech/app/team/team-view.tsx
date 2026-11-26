import 'lenis/dist/lenis.css';
import Link from 'next/link';
import { ReactLenis } from 'lenis/react';
import { plural, roleName, type Invite } from '@/lib/business';
import { nepalDate } from '@/lib/plans';
import type { Member, Org } from '@/lib/supabase';
import a from '../account.module.css';
import { createInvite, revokeInvite, saveMember } from '../actions';
import { Notices } from '../dashboard-view';
import page from '../dashboard.module.css';
import s from '../plans/plans.module.css';
import { CopyLink } from './copy-link';

type Service = { key: string; name: string; roles: string[] };

type Props = {
  org: Org;
  userId: string;
  members: Member[] | null; // null: they could not be loaded
  offered: Service[]; // the apps this business has
  pending: (Invite & { link: string })[];
  created?: string; // the link of the invitation just made
  error?: string;
  message?: string;
  preview?: boolean; // look only: nothing is saved
  now?: Date;
};

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function RoleSelect({ service, value = '' }: { service: Service; value?: string }) {
  return (
    <label>{service.name}
      <select name={`role_${service.key}`} defaultValue={value}>
        <option value="">No access</option>
        {service.roles.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
      </select>
    </label>
  );
}

export function TeamView({ org, userId, members, offered, pending, created, error, message, preview = false, now = new Date() }: Props) {
  const submit = preview ? 'button' : 'submit';

  return (
    <div className={`${page.page} ${a.page}`}>
      <ReactLenis root options={{ anchors: true }} />
      <div className={page.head}>
        <div>
          <h1>Team Members</h1>
          <p className={page.sub}>Choose each person&rsquo;s role in {org.name} and in each app.</p>
        </div>
      </div>

      <Notices error={error ?? (members ? undefined : 'Your team could not be loaded. Reload the page to try again.')} message={message} />

      {created && (
        <section className={a.created}>
          <h2>Invitation created</h2>
          <p>Send this link to the person. It works once, for the email you entered, and expires in 7 days.</p>
          <div className={a.link}><CopyLink value={created} /></div>
        </section>
      )}

      <div className={a.sheet}>
        <section className={a.section} aria-labelledby="invite-title">
          <div className={a.about}>
            <h2 id="invite-title">Invite someone</h2>
            <p>You get a link for one email address. Send it to them yourself.</p>
          </div>
          <div className={a.body}>
            <form action={preview ? undefined : createInvite} className={a.form}>
              <input type="hidden" name="org_id" value={org.id} />
              <div className={a.fields}>
                <label>Email<input name="email" type="email" autoComplete="off" required /></label>
                <label>Business role
                  <select name="org_role" defaultValue="member"><option value="member">Member</option><option value="admin">Admin</option></select>
                </label>
                {offered.map((svc) => <RoleSelect key={svc.key} service={svc} />)}
              </div>
              <button type={submit} className={`${s.button} ${s.primary}`}>Create invitation</button>
            </form>
          </div>
        </section>
      </div>

      {!!pending.length && (
        <section className={s.card} aria-labelledby="pending-title">
          <div className={s.cardHead}><h2 id="pending-title">Pending invitations</h2></div>
          <ul className={a.rows}>
            {pending.map((i) => {
              const over = new Date(i.expires_at) <= now;
              return (
                <li key={i.id} className={a.row}>
                  <span className={a.who}><strong>{i.email}</strong><small>{roleName(i.org_role)} · {over ? 'link no longer works' : `expires ${nepalDate(new Date(i.expires_at))}`}</small></span>
                  {over && <span className={`${s.tag} ${s.over}`}>Expired</span>}
                  <div className={a.link}><CopyLink value={i.link} /></div>
                  <form action={preview ? undefined : revokeInvite}>
                    <input type="hidden" name="id" value={i.id} />
                    <button type={submit} className={a.remove} aria-label={`Revoke the invitation for ${i.email}`}>Revoke</button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {members && (
        <section className={s.card} aria-labelledby="members-title">
          <div className={s.cardHead}><h2 id="members-title">Members</h2><span className={page.sub}>{plural(members.length, 'person', 'people')}</span></div>
          <ul className={a.rows}>
            {members.map((m) => {
              const isSelf = m.user_id === userId;
              // Your own business role and sign-in cannot be changed here, nor the owner's
              const manage = m.org_role !== 'owner' && !isSelf;
              const name = m.full_name || m.email;
              const access = offered.filter((svc) => m.service_roles[svc.key]).map((svc) => `${svc.name}: ${roleName(m.service_roles[svc.key])}`).join(' · ');
              const line = (
                <>
                  <span className={a.initials} aria-hidden="true">{initials(name)}</span>
                  <span className={a.who}><strong>{name}{isSelf && ' (you)'}</strong><small>{m.full_name && `${m.email} · `}joined {nepalDate(new Date(m.joined_at))}</small></span>
                  <span className={`${s.tag} ${m.org_role === 'member' ? a.quiet : s.info}`}>{roleName(m.org_role)}</span>
                  {m.status !== 'active' && <span className={`${s.tag} ${s.over}`}>Disabled</span>}
                  <span className={a.detail}>{access || 'No app access'}</span>
                </>
              );
              if (!offered.length && !manage) return <li key={m.user_id} className={a.row}>{line}</li>;
              return (
                <li key={m.user_id}>
                  <details className={a.person}>
                    <summary className={a.row}>{line}</summary>
                    <form action={preview ? undefined : saveMember} className={a.form}>
                      <input type="hidden" name="org_id" value={org.id} />
                      <input type="hidden" name="user_id" value={m.user_id} />
                      {manage && <input type="hidden" name="manage" value="1" />}
                      <div className={a.fields}>
                        {manage ? (
                          <label>Business role
                            <select name="org_role" defaultValue={m.org_role}><option value="member">Member</option><option value="admin">Admin</option></select>
                          </label>
                        ) : (
                          <div className={a.field}>Business role<span className={a.fixed}>{roleName(m.org_role)} (cannot be changed here)</span></div>
                        )}
                        {offered.map((svc) => <RoleSelect key={svc.key} service={svc} value={m.service_roles[svc.key]} />)}
                      </div>
                      {manage && <label className={a.check}><input type="checkbox" name="active" defaultChecked={m.status === 'active'} /> Active (can sign in to apps)</label>}
                      <button type={submit} className={`${s.button} ${s.primary}`}>Save changes</button>
                    </form>
                  </details>
                </li>
              );
            })}
          </ul>
          {!offered.length && <p className={a.padded}>No apps are added yet. <Link href="/apps">Add apps</Link>, then give people roles here.</p>}
        </section>
      )}
    </div>
  );
}
