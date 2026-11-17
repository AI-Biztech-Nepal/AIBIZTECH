-- Run in the Supabase SQL Editor. Finds what calls feature_switch, which breaks "Start free trial".
select event_object_schema, event_object_table, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers where action_statement ilike '%feature_switch%';

select n.nspname as schema, p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'feature_switch' or pg_get_functiondef(p.oid) ilike '%feature_switch%';

select tablename, policyname, cmd, qual, with_check from pg_policies
where coalesce(qual, '') ilike '%feature_switch%' or coalesce(with_check, '') ilike '%feature_switch%';
