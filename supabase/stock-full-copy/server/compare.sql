select format('select %L, count(*), coalesce(md5(string_agg(h, %L order by h)), %L) from (select md5(t::text) h from %I.%I t) s;', table_name, '', '-', table_schema, table_name)
from information_schema.tables where table_schema = :'schema' and table_type = 'BASE TABLE' order by table_name
\gexec
