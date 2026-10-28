import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase';
import { markNotificationsRead, signOut, startTrial, updateProfile } from './actions';
import { Notice, type Search } from './notice';

export default async function Launcher({ searchParams }: { searchParams: Search }) {
  const { error, denied, message } = await searchParams;
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  if (ctx.orgs.length === 0) redirect('/onboarding');

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

  return (
    <main className="wide">
      <header>
        <strong>AI Biz Tech Nepal</strong>
        <span>{org.name}</span>
        <form action={signOut} className="inline"><button className="link">Sign out</button></form>
      </header>

      <h1>Hello{ctx.full_name ? `, ${ctx.full_name}` : ''}</h1>
      <Notice error={error} message={deniedName ? `You don't have access to ${deniedName} in ${org.name}. Ask your organization admin.` : message} />

      {org.verification_status === 'pending' && (
        <p role="status" className="banner">Your organization is awaiting verification. Services unlock once it is verified.</p>
      )}
      {org.verification_status === 'rejected' && (
        <p role="alert" className="banner error">Verification was rejected{org.verification_note ? `: ${org.verification_note}` : '.'} Contact support.</p>
      )}

      <div className="panels">
        <section className="tile">
          <h2>Profile</h2>
          <form action={updateProfile}>
            <label>Full name<input name="full_name" defaultValue={ctx.full_name ?? ''} maxLength={120} autoComplete="off" required /></label>
            <label>Phone<input name="phone" type="tel" defaultValue={profile?.phone ?? ''} pattern="+?[0-9][0-9 -]{6,19}" title="Digits, optionally starting with +" autoComplete="off" /></label>
            <button>Save</button>
          </form>
          <dl>
            <dt>Email</dt><dd>{claims?.claims.email ?? '—'}</dd>
            <dt>Organization</dt><dd>{org.name}</dd>
            <dt>Your role</dt><dd>{org.org_role}</dd>
            <dt>Status</dt><dd>{org.verification_status}</dd>
          </dl>
        </section>

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
      </div>

      <ul className="tiles">
        {services?.map((s) => {
          const role = org.services[s.key];
          const status = statusOf.get(s.key);
          const expired = status === 'trial' && (trialEnd.get(s.key) ?? 0) <= Date.now();
          return (
            <li key={s.key} className="tile">
              <h2>{s.name}</h2>
              {role ? (
                <>
                  <p>{role}{status === 'trial' ? ` · trial, ${daysLeft(s.key)} ${daysLeft(s.key) === 1 ? 'day' : 'days'} left` : ''}</p>
                  <a href={s.base_url} className="button">Open</a>
                </>
              ) : isAdmin && verified && !expired && status !== 'suspended' ? (
                <form action={startTrial}>
                  <input type="hidden" name="org_id" value={org.id} />
                  <input type="hidden" name="service_key" value={s.key} />
                  <input type="hidden" name="enabled" value={status ? '1' : ''} />
                  <p>{status ? 'Enabled, but you have no role yet.' : 'Not enabled for your organization.'}</p>
                  <button>{status ? 'Give me access' : 'Start free trial'}</button>
                </form>
              ) : (
                <p>{!verified ? 'Available once your organization is verified.' : expired ? 'Trial ended. Contact us to subscribe.' : status === 'suspended' ? 'Suspended.' : 'No access. Ask your organization admin.'}</p>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
