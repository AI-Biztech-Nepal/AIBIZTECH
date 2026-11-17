-- Verification is paused while the platform is being completed: every organization starts verified.
-- To bring review back later: alter column verification_status set default 'pending'.
alter table core.organizations alter column verification_status set default 'verified';
update core.organizations set verification_status = 'verified', verified_at = coalesce(verified_at, now())
  where verification_status = 'pending';

-- Changing the PAN no longer sends an organization back to review
create or replace function core.reset_verification() returns trigger
language plpgsql set search_path = ''
as $$ begin return new; end $$;
