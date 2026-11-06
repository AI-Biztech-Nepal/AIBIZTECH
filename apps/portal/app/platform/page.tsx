import Link from 'next/link';
import { platformClient, ago } from '@/lib/platform';

type Activity = { action: string; detail: string | null; created_at: string; org_id: string | null; org_name: string | null; admin_name: string | null };
type ServiceRow = { key: string; name: string; active: number; trial: number; ending: number; expired: number; suspended: number };

function describe(a: Activity, serviceName: (key: string) => string) {
  const org = a.org_name ?? 'an organization';
  if (a.action === 'review:verified') return `Approved ${org}`;
  if (a.action === 'review:rejected') return `Rejected ${org}${a.detail ? `: ${a.detail}` : ''}`;
  if (a.action === 'review:pending') return `Reopened review for ${org}`;
  if (a.action.startsWith('service:')) return `${serviceName(a.action.slice(8))} for ${org}: ${a.detail ?? 'updated'}`;
  return a.action;
}

const num = (n: number) => (n ? n : <span className="sub">0</span>);

export default async function Overview() {
  const supabase = await platformClient();
  const { data: o, error } = await supabase.schema('core').rpc('platform_overview');
  if (error) throw error;

  const { orgs, services, pending, recent, activity } = o as {
    orgs: { total: number; pending: number; verified: number; rejected: number; new_7d: number };
    services: ServiceRow[]; pending: { id: string; name: string; owner_name: string | null; created_at: string }[];
    recent: { id: string; name: string; verification_status: string; created_at: string }[]; activity: Activity[];
  };
  const serviceName = (key: string) => services.find((s) => s.key === key)?.name ?? key;
  const tone = (s: string) => (s === 'verified' ? 'live' : s === 'pending' ? 'warn' : 'bad');

  return (
    <main className="pf-main">
      <div className="pf-title">
        <h1>Overview</h1>
        <p className="sub">{orgs.total} {orgs.total === 1 ? 'organization' : 'organizations'}, {orgs.new_7d} new in the last 7 days.</p>
      </div>

      <div className="pf-grid">
        <section aria-labelledby="queue">
          <div className="block-head">
            <h2 id="queue">Needs review {orgs.pending > 0 && <span className="badge">{orgs.pending}</span>}</h2>
            {orgs.pending > 5 && <Link href="/platform/orgs?status=pending">See all</Link>}
          </div>
          {pending.length === 0 ? (
            <p className="empty">Nothing waiting. New organizations appear here the moment they register.</p>
          ) : (
            <ul className="rows">
              {pending.map((p) => (
                <li key={p.id}>
                  <div className="grow"><h3>{p.name}</h3><span className="sub">{p.owner_name || 'No owner name'} · registered {ago(p.created_at)}</span></div>
                  <Link href={`/platform/orgs/${p.id}`} className="button">Review</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="pipeline">
          <div className="block-head"><h2 id="pipeline">Organizations</h2><Link href="/platform/orgs">All</Link></div>
          <div className="box">
            <div className="bar" role="img" aria-label={`${orgs.verified} verified, ${orgs.pending} pending, ${orgs.rejected} rejected`}>
              {orgs.verified > 0 && <span style={{ flex: orgs.verified, background: 'var(--ok)' }} />}
              {orgs.pending > 0 && <span style={{ flex: orgs.pending, background: 'var(--warn)' }} />}
              {orgs.rejected > 0 && <span style={{ flex: orgs.rejected, background: 'var(--error)' }} />}
            </div>
            <ul className="legend">
              <li><span className="dot" style={{ background: 'var(--ok)' }} />Verified <b>{orgs.verified}</b></li>
              <li><span className="dot" style={{ background: 'var(--warn)' }} />Pending <b>{orgs.pending}</b></li>
              <li><span className="dot" style={{ background: 'var(--error)' }} />Rejected <b>{orgs.rejected}</b></li>
            </ul>
          </div>
        </section>
      </div>

      <section aria-labelledby="subs" className="block">
        <div className="block-head"><h2 id="subs">Subscriptions</h2></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Service</th><th className="n">Active</th><th className="n">On trial</th><th className="n">Ending in 3 days</th><th className="n">Trial ended</th><th className="n">Suspended</th></tr></thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.key}>
                  <td><strong>{s.name}</strong></td>
                  <td className="n">{num(s.active)}</td><td className="n">{num(s.trial)}</td><td className="n">{num(s.ending)}</td><td className="n">{num(s.expired)}</td><td className="n">{num(s.suspended)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="pf-grid">
        <section aria-labelledby="recent">
          <div className="block-head"><h2 id="recent">Recent signups</h2></div>
          {recent.length === 0 ? <p className="empty">No organizations yet.</p> : (
            <ul className="rows">
              {recent.map((r) => (
                <li key={r.id}>
                  <div className="grow"><h3><Link href={`/platform/orgs/${r.id}`}>{r.name}</Link></h3><span className="sub">{ago(r.created_at)}</span></div>
                  <span className={`state ${tone(r.verification_status)}`}>{r.verification_status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="activity">
          <div className="block-head"><h2 id="activity">Recent activity</h2></div>
          {activity.length === 0 ? <p className="empty">Reviews and subscription changes you make are logged here.</p> : (
            <ul className="rows">
              {activity.map((a, i) => (
                <li key={i}>
                  <div className="grow"><span>{describe(a, serviceName)}</span><span className="sub">{a.admin_name ?? 'Platform staff'} · {ago(a.created_at)}</span></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
