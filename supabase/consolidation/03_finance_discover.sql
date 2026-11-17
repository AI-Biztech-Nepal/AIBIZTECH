-- Run in the FINANCE Supabase project SQL Editor. Read-only.
-- 1. Every column that points at a person (auth.users): these are re-pointed when users are merged.
select conrelid::regclass as table_name, a.attname as column_name, confrelid::regclass as references
from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and c.connamespace = 'public'::regnamespace;

-- 2. Functions, triggers, policies and views in public (all move with the schema)
select 'function' as kind, count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'
union all select 'trigger', count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal
union all select 'policy', count(*) from pg_policies where schemaname = 'public'
union all select 'view', count(*) from pg_views where schemaname = 'public';

-- 3. Storage buckets and their object counts
select bucket_id, count(*) as objects from storage.objects group by bucket_id;
