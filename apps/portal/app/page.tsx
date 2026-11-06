import { SubmitButton } from '@/app/submit-button';
import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase';
import { startTrial } from './actions';
import { recommend, type Profile } from '@/lib/recommend';
import { Header } from './header';
import { Notice, type Search } from './notice';

const date = (d: number | string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kathmandu' });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

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
  const [{ data: services }, { data: enabled }, { data: roles }, { data: business }] = await Promise.all([
    core.from('services').select('key, name, base_url').eq('is_active', true).order('name'),
    core.from('org_services').select('service_key, status, trial_ends_at').eq('org_id', org.id),
    core.from('service_roles').select('service_key').eq('org_id', org.id), // any member may read these
    core.from('organizations').select('business_type, business_needs, team_size').eq('id', org.id).maybeSingle(),
  ]);
  const statusOf = new Map((enabled ?? []).map((s) => [s.service_key, s.status as string]));
  const trialEnd = new Map((enabled ?? []).map((s) => [s.service_key, new Date(s.trial_ends_at).getTime()]));
  const people = new Map<string, number>();
  (roles ?? []).forEach((r) => people.set(r.service_key, (people.get(r.service_key) ?? 0) + 1));
  const daysLeft = (key: string) => Math.max(0, Math.ceil(((trialEnd.get(key) ?? 0) - Date.now()) / 864e5));
  const suggested = new Set(recommend((business ?? {}) as Profile));
  const all = [...(services ?? [])].sort((a, b) => Number(suggested.has(b.key)) - Number(suggested.has(a.key)));
  const live = (key: string) => org.services[key] && statusOf.get(key) !== 'suspended' && !(statusOf.get(key) === 'trial' && (trialEnd.get(key) ?? 0) <= Date.now());
  const ordered = [...all].sort((x, y) => Number(!!org.services[y.key]) - Number(!!org.services[x.key]));
  const inUse = all.filter((s) => live(s.key)).length;
  const deniedName = services?.find((s) => s.key === denied)?.name;

  return (
    <>
      <Header org={org} orgs={ctx.orgs} page="home" />
      <main className="wide">
        <div className="welcome">
          <h1>Hello{ctx.full_name ? `, ${ctx.full_name}` : ''}</h1>
          <p>{org.name} · <span className="cap">{org.org_role}</span> · {inUse} of {all.length} services in use</p>
        </div>
        <Notice error={error} message={deniedName ? `You don't have access to ${deniedName} in ${org.name}. Ask your organization admin.` : message} />

        {org.verification_status === 'pending' && (
          <p role="status" className="banner warn">Your organization is awaiting verification. Services unlock once it is verified.</p>
        )}
        {org.verification_status === 'rejected' && (
          <p role="alert" className="banner error">Verification was rejected{org.verification_note ? `: ${org.verification_note}` : '.'} Contact support.</p>
        )}

        <div className="home">
          <section aria-labelledby="services">
            <h2 id="services">Services</h2>
            <ul className="rows">
              {ordered.map((s) => {
                const role = org.services[s.key];
                const status = statusOf.get(s.key);
                const expired = status === 'trial' && (trialEnd.get(s.key) ?? 0) <= Date.now();
                const left = daysLeft(s.key);
                if (role) {
                  const tone = expired || status === 'suspended' ? 'off' : status === 'trial' ? (left <= 3 ? 'warn' : 'trial') : 'live';
                  const label = expired ? 'Trial ended' : status === 'suspended' ? 'Suspended' : status === 'trial' ? `Trial, ${plural(left, 'day')} left` : 'Active';
                  return (
                    <li key={s.key}>
                      <span className="mark" aria-hidden>{s.name[0]}</span>
                      <div className="grow">
                        <h3>{s.name}</h3>
                        <span className="sub">
                          <span className="cap">{role}</span> · {plural(people.get(s.key) ?? 0, 'person')} with access
                          {status === 'trial' && !expired && ` · ends ${date(trialEnd.get(s.key)!)}`}
                        </span>
                        {/* Live figures (stock count, attendance today, balance) go here once each service exposes a summary endpoint */}
                      </div>
                      <span className={`state ${tone}`}>{label}</span>
                      {!expired && status !== 'suspended' && <a href={s.base_url} className="button">Open</a>}
                    </li>
                  );
                }
                const canStart = isAdmin && verified && !expired && status !== 'suspended';
                const note = !verified ? 'Needs verification first.' : expired ? 'Trial ended. Contact us to subscribe.' : status === 'suspended' ? 'Suspended. Contact us.' : status ? 'Enabled, but you have no role yet.' : isAdmin ? 'Start a free trial for your organization.' : 'Ask your organization admin for access.';
                return (
                  <li key={s.key}>
                    <span className="mark quiet" aria-hidden>{s.name[0]}</span>
                    <div className="grow">
                      <h3>{s.name}{suggested.has(s.key) && <span className="chip accent">Recommended</span>}</h3>
                      <span className="sub">{note}</span>
                    </div>
                    {canStart && (
                      <form action={startTrial}>
                        <input type="hidden" name="org_id" value={org.id} />
                        <input type="hidden" name="service_key" value={s.key} />
                        <input type="hidden" name="enabled" value={status ? '1' : ''} />
                        <SubmitButton>{status ? 'Give me access' : 'Start free trial'}</SubmitButton>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
