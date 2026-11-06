'use client';

import type { Org } from '@/lib/supabase';
import { switchOrganization } from './actions';

export function OrgSwitcher({ org, orgs }: { org: Org; orgs: Org[] }) {
  return (
    <form action={switchOrganization}>
      <select name="org" defaultValue={org.id} aria-label="Organization" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <noscript><button>Switch</button></noscript>
    </form>
  );
}
