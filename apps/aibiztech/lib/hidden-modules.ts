import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// The modules a business unticked on Add apps. If they cannot be read, nothing is hidden.
export const hiddenModules = cache(async (supabase: SupabaseClient, org: string): Promise<string[]> => {
  const { data, error } = await supabase.schema('core').from('organizations').select('hidden_modules').eq('id', org).maybeSingle();
  if (error) console.error('Could not read the side panel choice:', error.message);
  return (data as { hidden_modules?: string[] | null } | null)?.hidden_modules ?? [];
});
