import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase';
import { TRIAL_DAYS } from '@/lib/signup';
import { addApps } from '../actions';
import { ServiceLogo } from '../icons';
import { Notice, type Search } from '../notice';
import { Shell } from '../shell';

export default async function Apps({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  if (!org) redirect('/onboarding');
  if (org.org_role === 'member') redirect('/');
  const { data: services } = await supabase.schema('core').from('services').select('key, name').eq('is_active', true).order('name');
  const mine = services?.filter((s) => org.services[s.key]) ?? [];
  const more = services?.filter((s) => !org.services[s.key]) ?? [];

  return (
    <Shell org={org} orgs={ctx.orgs} page="apps">
      <h1>Apps</h1>
      <Notice error={error} message={message} />
      <p className="muted">Apps for {org.name}. Tick any you want to add. Each starts with a free {TRIAL_DAYS}-day trial.</p>

      {!!mine.length && (
        <section className="tile">
          <h2>Your apps</h2>
          <div className="app-picker">
            {mine.map((s) => <div key={s.key} className="pick on static"><ServiceLogo svc={s} /><span>{s.name}</span><small>Active</small></div>)}
          </div>
        </section>
      )}

      <section className="tile">
        <h2>Add apps</h2>
        {!more.length ? <p>You already have every app.</p> : (
          <form action={addApps}>
            <div className="app-picker">
              {more.map((s) => (
                <label key={s.key} className="pick">
                  <input type="checkbox" name="apps" value={s.key} />
                  <ServiceLogo svc={s} />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
            <button>Add selected apps</button>
          </form>
        )}
      </section>
    </Shell>
  );
}
