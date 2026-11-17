import { Fragment } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase';
import { markNotificationsRead, startTrial, updateProfile } from './actions';
import { Header } from './header';
import { ServiceLogo } from './icons';
import { Notice, type Search } from './notice';

export default async function Launcher({ searchParams }: { searchParams: Search }) {
  const { error, denied, message } = await searchParams;
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  if (ctx.orgs.length === 0) {
    // New account: show every app right away; they unlock once an organization is set up and verified
    const { data: all } = await supabase.schema('core').from('services').select('key, name').eq('is_active', true).order('name');
    return (
      <main className="wide">
        <Header org={null} page="home" />
        <h1>Hello{ctx.full_name ? `, ${ctx.full_name}` : ''}</h1>
        <Notice error={error} message={message} />
        <p role="status" className="banner">
          Finish setting up your organization to unlock these apps. <Link href="/onboarding">Set up organization</Link>
        </p>
        <ul className="tiles">
          {all?.map((s) => (
            <li key={s.key} className="tile app">
              <Link href="/onboarding" className="app-link">
                <ServiceLogo svc={s} />
                <h2>{s.name}</h2>
                <p>Tap to set up your organization and unlock this app.</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  const isAdmin = org.org_role !== 'member';
  const verified = org.verification_status === 'verified';
  const core = supabase.schema('core');
  await core.rpc('notify_trials', { p_org: org.id }); // adds any due trial notices; harmless if it fails
  const [{ data: services }, { data: enabled }, { data: profile }, { data: claims }, { data: notes }, { data: reads }] = await Promise.all([
    core.from('services').select('key, name, base_url').eq('is_active', true).order('name'),
    core.from('org_services').select('service_key, status, trial_ends_at').eq('org_id', org.id),
    core.from('profiles').select('phone').eq('user_id', ctx.user_id).maybeSingle(),
    supabase.auth.getClaims(),
    // RLS returns these to owners and admins only
    core.from('notifications').select('id, title, body, created_at').eq('org_id', org.id).order('created_at', { ascending: false }).limit(20),
    core.from('notification_reads').select('notification_id'),
  ]);
  const readIds = new Set((reads ?? []).map((r) => r.notification_id));
  const unread = (notes ?? []).filter((n) => !readIds.has(n.id)).length;
  const statusOf = new Map((enabled ?? []).map((s) => [s.service_key, s.status as string]));
  const trialEnd = new Map((enabled ?? []).map((s) => [s.service_key, new Date(s.trial_ends_at).getTime()]));
  const daysLeft = (key: string) => Math.max(0, Math.ceil(((trialEnd.get(key) ?? 0) - Date.now()) / 864e5));
  const deniedName = services?.find((s) => s.key === denied)?.name;

  const initials = (ctx.full_name || org.name).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const statusLabel = org.verification_status === 'verified' ? 'Verified' : org.verification_status === 'rejected' ? 'Rejected' : 'Awaiting verification';

  return (
    <main className="wide">
      <Header org={org} orgs={ctx.orgs} page="home" />
      <Notice error={error} message={deniedName ? `You don't have access to ${deniedName} in ${org.name}. Ask your organization admin.` : message} />

      <section className="hero">
        <span className="avatar" aria-hidden="true">{initials}</span>
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1>{ctx.full_name || 'Hello'}</h1>
          <p className="hero-sub">{org.name} · <span className="cap">{org.org_role}</span></p>
        </div>
        <span className={`pill ${org.verification_status}`}>{statusLabel}</span>
      </section>

      {org.verification_status === 'pending' && (
        <p role="status" className="banner">Your organization is awaiting verification. Apps unlock once it is verified.</p>
      )}
      {org.verification_status === 'rejected' && (
        <p role="alert" className="banner error">Verification was rejected{org.verification_note ? `: ${org.verification_note}` : '.'} Contact support.</p>
      )}

      <h2 className="section">Your apps</h2>
      <ul className="tiles apps">
        {services?.map((s) => {
          const role = org.services[s.key];
          const status = statusOf.get(s.key);
          const expired = status === 'trial' && (trialEnd.get(s.key) ?? 0) <= Date.now();
          const chip = role ? (status === 'trial' ? `Trial · ${daysLeft(s.key)} ${daysLeft(s.key) === 1 ? 'day' : 'days'} left` : 'Active') : !verified ? 'Locked' : expired ? 'Trial ended' : status === 'suspended' ? 'Suspended' : 'Not started';
          return (
            <li key={s.key} className={`tile app-card${role ? ' on' : ''}`}>
              <div className="app-top"><ServiceLogo svc={s} /><span className="chip">{chip}</span></div>
              <h2>{s.name}</h2>
              {role ? (
                <>
                  <p className="cap">Your role: {role}</p>
                  <a href={`/go/${s.key}`} className="button">Open app</a>
                </>
              ) : isAdmin && verified && !expired && status !== 'suspended' ? (
                <form action={startTrial}>
                  <input type="hidden" name="org_id" value={org.id} />
                  <input type="hidden" name="service_key" value={s.key} />
                  <input type="hidden" name="enabled" value={status ? '1' : ''} />
                  <p>{status ? 'Enabled, but you have no role yet.' : 'Not enabled for your organization yet.'}</p>
                  <button>{status ? 'Give me access' : 'Start free trial'}</button>
                </form>
              ) : (
                <p>{!verified ? 'Unlocks once your organization is verified.' : expired ? 'Trial ended. Contact us to subscribe.' : status === 'suspended' ? 'Suspended.' : 'No access. Ask your organization admin.'}</p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="panels">
        <section className="tile">
          <h2>Notifications{unread > 0 && <span className="badge">{unread}</span>}</h2>
          {!isAdmin ? (
            <p>Subscription messages go to your organization's owners and admins.</p>
          ) : !notes?.length ? (
            <p>No notifications yet.</p>
          ) : (
            <>
              <ul className="notes">
                {notes.map((n) => (
                  <li key={n.id} className={readIds.has(n.id) ? '' : 'unread'}>
                    <strong>{n.title}</strong>
                    {n.body && <span>{n.body}</span>}
                    <time dateTime={n.created_at}>{new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kathmandu' })}</time>
                  </li>
                ))}
              </ul>
              {unread > 0 && (
                <form action={markNotificationsRead}>
                  <input type="hidden" name="org_id" value={org.id} />
                  <button className="link">Mark all as read</button>
                </form>
              )}
            </>
          )}
        </section>

        <section className="tile">
          <h2>Account</h2>
          <dl>
            <dt>Email</dt><dd>{claims?.claims.email ?? '—'}</dd>
            <dt>Organization</dt><dd>{org.name}</dd>
            <dt>Your role</dt><dd className="cap">{org.org_role}</dd>
            {services?.filter((s) => org.services[s.key]).map((s) => (
              <Fragment key={s.key}><dt>{s.name} role</dt><dd className="cap">{org.services[s.key]}</dd></Fragment>
            ))}
          </dl>
          <details className="edit">
            <summary>Edit profile</summary>
            <form action={updateProfile}>
              <label>Full name<input name="full_name" defaultValue={ctx.full_name ?? ''} maxLength={120} autoComplete="off" required /></label>
              <label>Phone<input name="phone" type="tel" defaultValue={profile?.phone ?? ''} pattern="+?[0-9][0-9 -]{6,19}" title="Digits, optionally starting with +" autoComplete="off" /></label>
              <button>Save</button>
            </form>
          </details>
        </section>
      </div>
    </main>
  );
}
