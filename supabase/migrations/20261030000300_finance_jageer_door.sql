-- Jageer Nepal (a separate product with its own Supabase project) mirrors sales and purchases into Finance by
-- calling public.finance_apply_jageer_bill / _record over PostgREST. Keep that contract unchanged so Jageer only
-- needs new Vault secrets (url, key; the sync secret still validates against the copied finance.finance_sync_secrets).

-- Finance's owner is now an org. Resolve a confirmed user's email to the org where they hold a finance role
-- (admin first, then oldest org).
create or replace function finance.finance_jageer_owner(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select r.org_id
    from auth.users u
    join core.service_roles r on r.user_id = u.id and r.service_key = 'finance'
    join core.organizations o on o.id = r.org_id
   where lower(u.email) = lower(btrim(p_email)) and u.email_confirmed_at is not null
   order by (r.role = 'admin') desc, o.created_at
   limit 1
$$;

-- The single door from outside into the finance schema. Secret-gated inside; nothing else is exposed.
create or replace function public.finance_apply_jageer_bill(
  p_secret text, p_op text, p_email text, p_bill jsonb, p_party jsonb default null, p_bank_name text default null)
returns jsonb language sql security definer set search_path = '' as $$
  select finance.finance_apply_jageer_bill(p_secret, p_op, p_email, p_bill, p_party, p_bank_name)
$$;

create or replace function public.finance_apply_jageer_record(
  p_secret text, p_op text, p_email text, p_kind text, p_row jsonb,
  p_party jsonb default null, p_bank jsonb default null, p_bank2 jsonb default null, p_category text default null)
returns jsonb language sql security definer set search_path = '' as $$
  select finance.finance_apply_jageer_record(p_secret, p_op, p_email, p_kind, p_row, p_party, p_bank, p_bank2, p_category)
$$;

revoke all on function public.finance_apply_jageer_bill(text, text, text, jsonb, jsonb, text) from public;
revoke all on function public.finance_apply_jageer_record(text, text, text, text, jsonb, jsonb, jsonb, jsonb, text) from public;
grant execute on function public.finance_apply_jageer_bill(text, text, text, jsonb, jsonb, text) to anon, authenticated, service_role;
grant execute on function public.finance_apply_jageer_record(text, text, text, text, jsonb, jsonb, jsonb, jsonb, text) to anon, authenticated, service_role;
