-- New trials last 7 days. Trials already running keep their end date. Safe to run more than once.
alter table core.org_services alter column trial_ends_at set default now() + interval '7 days';
