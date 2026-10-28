import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase';
import { signOut, startTrial, switchOrg } from './actions';
import { Notice, type Search } from './notice';

export default async function Launcher({ searchParams }: { searchParams: Search }) {
  const { error, denied } = await searchParams;
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  if (ctx.orgs.length === 0) redirect('/onboarding');

  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  const isAdmin = org.org_role !== 'member';
  const core = supabase.schema('core');
  const [{ data: services }, { data: enabled }] = await Promise.all([
    core.from('services').select('key, name, base_url').eq('is_active', true).order('name'),
    core.from('org_services').select('service_key, status').eq('org_id', org.id),
  ]);
  const statusOf = new Map((enabled ?? []).map((s) => [s.service_key, s.status as string]));
  const deniedName = services?.find((s) => s.key === denied)?.name;

  return (
    <main className="wide">
      <header>
        <strong>AI Biz Tech Nepal</strong>
        {ctx.orgs.length > 1 ? (
          <form action={switchOrg} className="inline">
            <label>
              Organization{' '}
              <select name="org_id" defaultValue={org.id}>
                {ctx.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <button>Switch</button>
          </form>
        ) : (
          <span>{org.name}</span>
        )}
        <form action={signOut} className="inline"><button className="link">Sign out</button></form>
      </header>

      <h1>Hello{ctx.full_name ? `, ${ctx.full_name}` : ''}</h1>
      <Notice error={error} message={deniedName && `You don't have access to ${deniedName} in ${org.name}. Ask your organization admin.`} />

      <ul className="tiles">
        {services?.map((s) => {
          const role = org.services[s.key];
          const status = statusOf.get(s.key);
          return (
            <li key={s.key} className="tile">
              <h2>{s.name}</h2>
              {role ? (
                <>
                  <p>{role}{status === 'trial' ? ' · trial' : ''}</p>
                  <a href={s.base_url} className="button">Open</a>
                </>
              ) : isAdmin && status !== 'suspended' ? (
                <form action={startTrial}>
                  <input type="hidden" name="org_id" value={org.id} />
                  <input type="hidden" name="service_key" value={s.key} />
                  <input type="hidden" name="enabled" value={status ? '1' : ''} />
                  <p>{status ? 'Enabled, but you have no role yet.' : 'Not enabled for your organization.'}</p>
                  <button>{status ? 'Give me access' : 'Start free trial'}</button>
                </form>
              ) : (
                <p>{status === 'suspended' ? 'Suspended.' : 'No access. Ask your organization admin.'}</p>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
