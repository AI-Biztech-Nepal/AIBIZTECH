-- Which modules a business has unticked on Add apps, so they are left out of its side panel. Empty = show everything.
-- A display choice only: it gives and removes no access. Safe to run more than once.
begin;
alter table core.organizations add column if not exists hidden_modules text[] not null default '{}';
grant update (hidden_modules) on core.organizations to authenticated;
commit;
notify pgrst, 'reload schema';
