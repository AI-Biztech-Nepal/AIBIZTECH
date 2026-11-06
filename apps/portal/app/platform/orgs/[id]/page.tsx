import Link from 'next/link';
import { notFound } from 'next/navigation';
import { platformClient, fmt } from '@/lib/platform';
import { BUSINESS_TYPES, NEEDS } from '@/lib/recommend';
import { SubmitButton } from '@/app/submit-button';
import { Notice } from '../../../notice';
import { reviewOrg, setService } from '../../actions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Svc = { key: string; name: string; status: string; trial_ends_at: string; enabled_at: string; people: number };
type Member = { name: string | null; email: string; org_role: string; status: string };

const left = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 864e5);

export default async function Org({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const { id } = await params;
  const { error, message } = await searchParams;
  if (!UUID.test(id)) notFound();

  const supabase = await platformClient();
  const { data: org, error: loadError } = await supabase.schema('core').rpc('platform_org', { p_org: id });
  if (loadError || !org) notFound();
  const photo = org.pan_photo_path ? (await supabase.storage.from('pan-cards').createSignedUrl(org.pan_photo_path, 300)).data?.signedUrl : null;

  const status: string = org.verification_status;
  const tone = status === 'verified' ? 'live' : status === 'pending' ? 'warn' : 'bad';
  const type = BUSINESS_TYPES.find((t) => t.id === org.business_type)?.label;
  const needs = (org.business_needs ?? []).map((n: string) => NEEDS.find((x) => x.id === n)?.label ?? n);

  const act = (svc: Svc, label: string, fields: Record<string, string>) => (
    <form action={setService}>
      <input type="hidden" name="org_id" value={id} />
      <input type="hidden" name="service_key" value={svc.key} />
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton className="ghost">{label}</SubmitButton>
    </form>
  );

  return (
    <main className="pf-main">
      <Link href="/platform/orgs" className="back">← Organizations</Link>
      <div className="pf-title">
        <h1>{org.name}</h1>
        <p className="sub"><span className={`state ${tone}`}>{status}</span> · registered {fmt(org.created_at)}</p>
      </div>
      <Notice error={error} message={message} />

      <section className="setting">
        <div><h2>Review</h2><p className="sub">Check the PAN against the card photo and the owner's details.</p></div>
        <div>
          <dl>
            <dt>PAN</dt><dd>{org.pan_no ?? '—'}</dd>
            <dt>Owner</dt><dd>{org.owner_name ?? '—'}</dd>
            {org.verified_at && <><dt>Verified</dt><dd>{fmt(org.verified_at)}</dd></>}
            {org.verification_note && <><dt>Reason given</dt><dd>{org.verification_note}</dd></>}
          </dl>
          {photo ? (
            <a href={photo} target="_blank" rel="noreferrer" className="pan"><img src={photo} alt={`PAN card photo for ${org.name}`} /></a>
          ) : <p className="sub">No PAN card photo uploaded.</p>}
          <div className="actions">
            {status !== 'verified' && (
              <form action={reviewOrg}>
                <input type="hidden" name="org_id" value={id} /><input type="hidden" name="status" value="verified" />
                <SubmitButton>Approve</SubmitButton>
              </form>
            )}
            {status !== 'pending' && (
              <form action={reviewOrg}>
                <input type="hidden" name="org_id" value={id} /><input type="hidden" name="status" value="pending" />
                <SubmitButton className="ghost">Reopen review</SubmitButton>
              </form>
            )}
          </div>
          {status !== 'rejected' && (
            <details className="reject">
              <summary>Reject…</summary>
              <form action={reviewOrg}>
                <input type="hidden" name="org_id" value={id} /><input type="hidden" name="status" value="rejected" />
                <label>Reason (the owner sees this)<input name="note" maxLength={300} required placeholder="e.g. PAN does not match the owner's name" /></label>
                <SubmitButton className="danger">Reject organization</SubmitButton>
              </form>
            </details>
          )}
        </div>
      </section>

      <section className="setting">
        <div><h2>Subscriptions</h2><p className="sub">Activate when they pay, suspend to pause access for everyone, or give more trial time.</p></div>
        {org.services.length === 0 ? <p className="empty">No services started yet.</p> : (
          <ul className="rows">
            {(org.services as Svc[]).map((s) => {
              const days = left(s.trial_ends_at);
              const t = s.status === 'active' ? 'live' : s.status === 'suspended' ? 'bad' : days <= 0 ? 'bad' : days <= 3 ? 'warn' : 'trial';
              const label = s.status === 'trial' ? (days > 0 ? `Trial, ${days} ${days === 1 ? 'day' : 'days'} left` : 'Trial ended') : s.status === 'active' ? 'Active' : 'Suspended';
              return (
                <li key={s.key} className="svc">
                  <div className="grow"><h3>{s.name}</h3><span className="sub">{s.people} {s.people === 1 ? 'person' : 'people'} with a role · started {fmt(s.enabled_at)}</span></div>
                  <span className={`state ${t}`}>{label}</span>
                  <div className="actions">
                    {s.status !== 'active' && act(s, 'Activate', { status: 'active' })}
                    {s.status === 'trial' && act(s, '+14 days', { extend: '14' })}
                    {s.status !== 'suspended' && act(s, 'Suspend', { status: 'suspended' })}
                    {s.status === 'suspended' && act(s, 'Back to trial', { status: 'trial', extend: '14' })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="setting">
        <div><h2>Organization</h2></div>
        <dl>
          <dt>Address</dt><dd>{org.address || '—'}</dd>
          <dt>Phone</dt><dd>{org.phone || '—'}</dd>
          <dt>Email</dt><dd>{org.email || '—'}</dd>
          <dt>Owner address</dt><dd>{org.owner_address || '—'}</dd>
          <dt>Owner phone</dt><dd>{org.owner_phone || '—'}</dd>
          <dt>Owner email</dt><dd>{org.owner_email || '—'}</dd>
        </dl>
      </section>

      <section className="setting">
        <div><h2>Business profile</h2><p className="sub">Answers from the setup questions.</p></div>
        {type || needs.length || org.team_size ? (
          <dl>
            <dt>Business</dt><dd>{type ?? '—'}</dd>
            <dt>Wants to manage</dt><dd>{needs.length ? needs.join(', ') : '—'}</dd>
            <dt>Team size</dt><dd>{org.team_size ?? '—'}</dd>
          </dl>
        ) : <p className="sub">Not provided.</p>}
      </section>

      <section className="setting">
        <div><h2>Members</h2></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {(org.members as Member[]).map((m, i) => (
                <tr key={i}><td>{m.name || '—'}</td><td className="wrap">{m.email}</td><td className="cap">{m.org_role}</td><td className="cap">{m.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
