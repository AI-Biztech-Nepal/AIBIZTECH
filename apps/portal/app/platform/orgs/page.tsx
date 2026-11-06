import Link from 'next/link';
import { platformClient, ago } from '@/lib/platform';
import { SERVICE_LABELS } from '@/lib/recommend';

const PAGE = 25;
const STATUSES = ['pending', 'verified', 'rejected'] as const;
type Row = { id: string; name: string; verification_status: string; created_at: string; owner_name: string | null; owner_email: string | null; members: number; services: { key: string; status: string }[] };

export default async function Orgs({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await platformClient();
  const { data, error } = await supabase.schema('core').rpc('platform_orgs', { p_status: status ?? null, p_search: q || null, p_limit: PAGE, p_offset: (page - 1) * PAGE });
  if (error) throw error;
  const { rows, total, counts } = data as { rows: Row[]; total: number; counts: Record<'all' | (typeof STATUSES)[number], number> };

  const href = (over: { status?: string; page?: number }) => {
    const p = new URLSearchParams();
    const s = 'status' in over ? over.status : status;
    if (s) p.set('status', s);
    if (q) p.set('q', q);
    if (over.page && over.page > 1) p.set('page', String(over.page));
    return `/platform/orgs${p.size ? `?${p}` : ''}`;
  };
  const tone = (s: string) => (s === 'verified' ? 'live' : s === 'pending' ? 'warn' : 'bad');
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <main className="pf-main">
      <div className="pf-title"><h1>Organizations</h1></div>

      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Review status">
          <Link href={href({ status: undefined })} aria-current={!status ? 'page' : undefined}>All <span>{counts.all}</span></Link>
          {STATUSES.map((s) => (
            <Link key={s} href={href({ status: s })} aria-current={status === s ? 'page' : undefined} className="cap">{s} <span>{counts[s]}</span></Link>
          ))}
        </div>
        <form action="/platform/orgs" className="search" role="search">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="Search name, owner, email or PAN" aria-label="Search organizations" type="search" />
          <button>Search</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="empty">{q || status ? 'No organizations match.' : 'No organizations yet.'} {(q || status) && <Link href="/platform/orgs">Clear filters</Link>}</p>
      ) : (
        <div className="table-wrap">
          <table className="table linked">
            <thead><tr><th>Organization</th><th>Status</th><th>Services</th><th className="n">Members</th><th>Registered</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/platform/orgs/${r.id}`} className="rowlink"><strong>{r.name}</strong></Link><span className="sub block">{r.owner_name || r.owner_email || '—'}</span></td>
                  <td><span className={`state ${tone(r.verification_status)}`}>{r.verification_status}</span></td>
                  <td>{r.services.length ? r.services.map((s) => <span key={s.key} className="chip">{SERVICE_LABELS[s.key] ?? s.key} · {s.status}</span>) : <span className="sub">None</span>}</td>
                  <td className="n">{r.members}</td>
                  <td className="sub">{ago(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="pager" aria-label="Pages">
          {page > 1 ? <Link href={href({ page: page - 1 })}>Previous</Link> : <span />}
          <span className="sub">Page {page} of {pages}</span>
          {page < pages ? <Link href={href({ page: page + 1 })}>Next</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
