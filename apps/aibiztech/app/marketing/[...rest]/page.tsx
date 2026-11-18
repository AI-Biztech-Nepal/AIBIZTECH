import { getMarketing } from '@/lib/marketing';
import { Shell } from '../../shell';

export default async function NotYet() {
  const { ctx, org } = await getMarketing();
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame">
      <h1>Coming soon</h1>
      <p>This part of Marketing is not built yet. Overview, Leads and CRM are ready.</p>
      <p><a className="button" href="/marketing/leads">Go to Leads</a></p>
    </Shell>
  );
}
