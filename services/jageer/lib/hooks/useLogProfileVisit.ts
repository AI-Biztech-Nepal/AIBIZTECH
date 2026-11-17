// lib/hooks/useLogProfileVisit.ts
import { useEffect, useRef } from 'react';
import { supabase } from '../supabase';

/**
 * Fires once per mount: logs that `viewerId` looked at `profileId`'s public profile/shop, for
 * that reseller's Marketing > Visits view (see migration 0110). Never blocks the screen and never
 * surfaces an error to the viewer - a missed log just means an undercount, not a broken page.
 * Skips logging a reseller looking at their own profile.
 */
export function useLogProfileVisit(profileId: string | undefined, viewerId: string | undefined) {
  const logged = useRef<string | null>(null);
  useEffect(() => {
    if (!profileId || profileId === viewerId || logged.current === profileId) return;
    logged.current = profileId;
    // Cast needed for the same reason useSupabaseInsert casts (see useSupabase.ts): postgrest-js's
    // overload resolution against this hand-written Database type doesn't hold up for a literal
    // table name either. No .select() after the insert - RLS only grants this viewer an insert,
    // not a read back, on a profile that isn't their own.
    (supabase.from('profile_visits') as any)
      .insert({ profile_id: profileId, viewer_id: viewerId ?? null })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.warn('Visit not logged:', error.message);
      });
  }, [profileId, viewerId]);
}
