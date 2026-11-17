-- Run in the SQL Editor of EACH Supabase project. Read-only. Send back the result (counts only, no personal data).
select table_schema, table_name,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint as row_count
from information_schema.tables
where table_type = 'BASE TABLE' and table_schema in ('public', 'core')
order by table_schema, table_name;

select 'auth.users' as what, count(*) as n from auth.users;
select 'storage objects' as what, bucket_id, count(*) as n from storage.objects group by bucket_id;
