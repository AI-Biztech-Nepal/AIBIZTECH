-- Let PostgREST (the Data API) serve the service schemas. Anon/authenticated still need usage + RLS to read anything.
-- Hosted Supabase also lists these in Dashboard > Settings > API > Exposed schemas; if that list is saved by hand it
-- can overwrite this role setting, so keep both in step.
alter role authenticator set pgrst.db_schemas = 'public,graphql_public,core,finance,attendance';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
