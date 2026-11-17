-- 0110: anonymous page-view log for a reseller's public profile/shop, feeding their new
-- Marketing tab's "Visits" view. No message content and no page path are kept - just who looked
-- (their profile id, if signed in) and when.
--
-- Run once in the Supabase SQL Editor. Safe to run more than once.

create table if not exists profile_visits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  viewer_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists profile_visits_profile_idx on profile_visits(profile_id, created_at desc);

alter table profile_visits enable row level security;

-- Any signed-in visitor can log that they looked at a profile - but only as themselves, never on
-- someone else's behalf (viewer_id must be their own id, or left out entirely).
drop policy if exists profile_visits_insert on profile_visits;
create policy profile_visits_insert on profile_visits
  for insert to authenticated
  with check (viewer_id is null or viewer_id = auth.uid());

-- Only the profile that was visited (or an admin) can read its own visit log back.
drop policy if exists profile_visits_select_own on profile_visits;
create policy profile_visits_select_own on profile_visits
  for select using (profile_id = auth.uid() or is_admin());
