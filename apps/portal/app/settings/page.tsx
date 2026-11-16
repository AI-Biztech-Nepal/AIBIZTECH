import { SubmitButton } from '@/app/submit-button';
import { redirect } from 'next/navigation';
import { getContext, type Member } from '@/lib/supabase';
import { cancelFeatureRequest, requestFeatures, updateOrganization, updateProfile } from '../actions';
import { Header } from '../header';
import { Notice, type Search } from '../notice';
import { suggestedFeatures } from '@/lib/recommend';

const date = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kathmandu' });
const days = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 864e5);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export default async function Settings({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  if (!org) redirect('/onboarding');
  const isAdmin = org.org_role !== 'member';

  const core = supabase.schema('core');
  // The organization sections are for owners and admins; RLS only returns these rows to them
  const none = { data: null };
  const [{ data: details }, { data: rows }, { data: services }, { data: enabled }, { data: pending }, { data: profile }, { data: claims }, { data: flags }, { data: catalogue }, { data: openRequest }] = await Promise.all([
    isAdmin ? core.from('organizations').select('name, address, phone, email, owner_name, owner_phone, owner_email, pan_no, created_at, verified_at, business_type').eq('id', org.id).single() : none,
    isAdmin ? core.rpc('org_members', { p_org: org.id }) : none,
    isAdmin ? core.from('services').select('key, name, roles').eq('is_active', true).order('name') : none,
    isAdmin ? core.from('org_services').select('service_key, status, trial_ends_at, enabled_at').eq('org_id', org.id) : none,
    isAdmin ? core.from('invitations').select('id, email, org_role, expires_at').eq('org_id', org.id).is('accepted_at', null) : none,
    core.from('profiles').select('phone').eq('user_id', ctx.user_id).maybeSingle(),
    supabase.auth.getClaims(),
    isAdmin ? core.rpc('org_features', { p_org: org.id }) : none,
    isAdmin ? core.from('features').select('key, service_key, name, description, requires').eq('is_active', true).order('name') : none,
    isAdmin ? core.from('feature_requests').select('id, turn_on, turn_off, note, created_at').eq('org_id', org.id).eq('status', 'pending').maybeSingle() : none,
  ]);
  const members = (rows ?? []) as Member[];
  const active = members.filter((m) => m.status === 'active');
  const disabled = members.length - active.length;
  const expiredInvites = (pending ?? []).filter((i) => new Date(i.expires_at) <= new Date()).length;
  const suggested = new Set(suggestedFeatures(details?.business_type ?? null));
  const isOn = new Map(((flags ?? []) as { feature_key: string; enabled: boolean }[]).map((f) => [f.feature_key, f.enabled]));
  const names = new Map((catalogue ?? []).map((f) => [f.key, f.name]));
  const shown = (catalogue ?? []).filter((f) => isOn.has(f.key)); // only features of services this organization has
  const enabledBy = new Map((enabled ?? []).map((s) => [s.service_key, s]));

  // What needs the admin's attention, most urgent first
  const alerts: { text: string; bad?: boolean }[] = [];
  if (org.verification_status === 'pending') alerts.push({ text: 'Your organization is awaiting verification. Services unlock once it is verified.' });
  if (org.verification_status === 'rejected') alerts.push({ text: `Verification was rejected${org.verification_note ? `: ${org.verification_note}` : ''}. Contact support.`, bad: true });
  for (const s of services ?? []) {
    const e = enabledBy.get(s.key);
    if (!e) continue;
    const people = active.filter((m) => m.service_roles[s.key]).length;
    if (e.status === 'trial' && days(e.trial_ends_at) <= 0) alerts.push({ text: `${s.name} trial has ended. Contact us to subscribe and restore access.`, bad: true });
    else if (e.status === 'trial' && days(e.trial_ends_at) <= 3) alerts.push({ text: `${s.name} trial ends in ${plural(days(e.trial_ends_at), 'day')}. Contact us to subscribe.` });
    if (e.status === 'suspended') alerts.push({ text: `${s.name} is suspended.`, bad: true });
    if (!people) alerts.push({ text: `Nobody has a role in ${s.name} yet. Assign roles on the Team page.` });
  }
  if (expiredInvites) alerts.push({ text: `${plural(expiredInvites, 'invitation')} expired without being accepted. Revoke and resend on the Team page.` });
  if (disabled) alerts.push({ text: `${plural(disabled, 'member')} disabled. They cannot sign in to services.` });

  return (
    <>
      <Header org={org} orgs={ctx.orgs} page="settings" />
      <main className="wide">
        <h1>Settings</h1>
        <Notice error={error} message={message} />

        <section className="setting">
          <div><h2>Your profile</h2><p className="sub">Signed in as {claims?.claims.email ?? '—'}</p></div>
          <form action={updateProfile}>
            <div className="grid2">
              <label>Full name<input name="full_name" defaultValue={ctx.full_name ?? ''} maxLength={120} autoComplete="name" required /></label>
              <label>Phone<input name="phone" type="tel" defaultValue={profile?.phone ?? ''} pattern="\+?[0-9][0-9 \-]{6,19}" title="Digits, optionally starting with +" autoComplete="tel" /></label>
            </div>
            <SubmitButton>Save profile</SubmitButton>
          </form>
        </section>

        {isAdmin && (
          <>
            <section className="setting">
              <div><h2>Status</h2><p className="sub">Verification, and anything that needs you.</p></div>
              <div>
                <dl>
                  <dt>Verification</dt><dd className="cap">{org.verification_status}{details?.verified_at ? `, ${date(details.verified_at)}` : ''}</dd>
                  <dt>Created</dt><dd>{details ? date(details.created_at) : '—'}</dd>
                  <dt>PAN</dt><dd>{details?.pan_no ? `•••••${details.pan_no.slice(-4)}` : '—'}</dd>
                </dl>
                {alerts.length > 0 ? (
                  <ul className="alerts">{alerts.map((a, i) => <li key={i} className={a.bad ? 'bad' : ''}>{a.text}</li>)}</ul>
                ) : <p className="sub">Nothing needs your attention.</p>}
              </div>
            </section>

            {shown.length > 0 && (
              <section className="setting">
                <div><h2>Features</h2><p className="sub">Choose what your portal includes. We review your request and set it up; nothing changes until then.</p></div>
                <div>
                  {openRequest ? (
                    <>
                      <p className="sub">Waiting for review since {date(openRequest.created_at)}.</p>
                      <ul className="alerts">
                        {openRequest.turn_on.map((k: string) => <li key={k}>Add {names.get(k) ?? k}</li>)}
                        {openRequest.turn_off.map((k: string) => <li key={k}>Remove {names.get(k) ?? k}</li>)}
                      </ul>
                      <form action={cancelFeatureRequest}>
                        <input type="hidden" name="id" value={openRequest.id} />
                        <SubmitButton className="ghost">Cancel request</SubmitButton>
                      </form>
                    </>
                  ) : (
                    <form action={requestFeatures}>
                      <input type="hidden" name="org_id" value={org.id} />
                      <div className="choice-list">
                        {shown.map((f) => (
                          <label key={f.key} className="choice">
                            <input type="checkbox" name="want" value={f.key} defaultChecked={isOn.get(f.key)} />
                            <span>
                              <strong>{f.name}</strong>{suggested.has(f.key) && !isOn.get(f.key) && <> <em className="state trial">Suggested for your business</em></>}
                              <span className="sub"> {f.description}{f.requires.length > 0 && ` Needs ${f.requires.map((r: string) => names.get(r) ?? r).join(', ')}.`}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <label>Anything we should know? (optional)<input name="note" maxLength={500} placeholder="e.g. we repair fridges and sell parts" /></label>
                      <SubmitButton>Send request</SubmitButton>
                    </form>
                  )}
                </div>
              </section>
            )}

            <section className="setting">
              <div><h2>Organization</h2><p className="sub">Contact details shown to your team.</p></div>
              <form action={updateOrganization}>
                <input type="hidden" name="org_id" value={org.id} />
                <div className="grid2">
                  <label>Name<input name="name" defaultValue={details?.name ?? ''} maxLength={120} required /></label>
                  <label>Email<input name="email" type="email" defaultValue={details?.email ?? ''} required /></label>
                  <label>Address<input name="address" defaultValue={details?.address ?? ''} maxLength={200} required /></label>
                  <label>Phone<input name="phone" type="tel" defaultValue={details?.phone ?? ''} pattern="\+?[0-9][0-9 \-]{6,19}" title="Digits, optionally starting with +" required /></label>
                </div>
                <SubmitButton>Save details</SubmitButton>
              </form>
            </section>

            <section className="setting">
              <div><h2>Owner</h2><p className="sub">To change the PAN or the owner, contact support. A new PAN restarts verification.</p></div>
              <dl>
                <dt>Name</dt><dd>{details?.owner_name || '—'}</dd>
                <dt>Phone</dt><dd>{details?.owner_phone || '—'}</dd>
                <dt>Email</dt><dd>{details?.owner_email || '—'}</dd>
              </dl>
            </section>
          </>
        )}
      </main>
    </>
  );
}
