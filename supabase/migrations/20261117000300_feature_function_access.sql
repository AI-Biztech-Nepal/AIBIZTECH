-- "Start free trial" failed with: permission denied for function feature_switch.
-- The feature-flag helpers are read-only true/false lookups that policies and triggers call as the signed-in user,
-- so let signed-in users (and the service role) run them. Covers feature_switch and its siblings whatever their arguments.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'core' and p.prokind = 'f' and p.proname ilike '%feature%'
  loop
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;

-- The tables those helpers read must be readable too, or the next error is "permission denied for table features"
grant select on core.features, core.org_features to authenticated, service_role;
