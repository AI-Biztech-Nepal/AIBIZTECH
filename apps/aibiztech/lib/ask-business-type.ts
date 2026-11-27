import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { businessKind } from './business-kind-load';
import type { Org } from './supabase';

// Before showing stock or finance screens, an owner or admin of a business with nothing recorded is asked what it is
export async function askBusinessType(supabase: SupabaseClient, org: Org) {
  if (org.org_role === 'member' || !(org.services.stock || org.services.finance)) return;
  if (!(await businessKind(supabase, org.id))) redirect('/business-type');
}
