-- Organization verification: required business and owner details, PAN, and a review status.

alter table core.organizations
  add column email               text,
  add column owner_name          text,
  add column owner_address       text,
  add column owner_phone         text,
  add column owner_email         text,
  add column pan_no              text,
  add column pan_photo_path      text,   -- object path in the private 'pan-cards' storage bucket
  add column verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  add column verification_note   text,   -- shown to the owner when rejected
  add column verified_at         timestamptz,
  add column verified_by         uuid references auth.users(id);

-- One organization per registered PAN
create unique index organizations_pan_no_key on core.organizations (pan_no);

-- Only the service role may change the review fields: admins can edit their own details, not their status
revoke update on core.organizations from authenticated;
grant update (name, address, phone, email, owner_name, owner_address, owner_phone, owner_email, pan_no, pan_photo_path, logo_url)
  on core.organizations to authenticated;

-- Changing the PAN invalidates an earlier review
create function core.reset_verification() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.pan_no is distinct from old.pan_no and current_user <> 'service_role' then
    new.verification_status := 'pending';
    new.verification_note := null;
    new.verified_at := null;
    new.verified_by := null;
  end if;
  return new;
end
$$;
create trigger organizations_reset_verification before update on core.organizations
  for each row execute function core.reset_verification();

create function core.org_verified(p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select verification_status = 'verified' from core.organizations where id = p_org), false) $$;

-- Services can only be started by a verified organization
drop policy org_services_insert on core.org_services;
create policy org_services_insert on core.org_services for insert to authenticated
  with check (core.is_org_admin(org_id) and core.org_verified(org_id) and status = 'trial' and plan is null);

-- my_context now reports the verification status of each org
create or replace function core.my_context()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'user_id',       p.user_id,
    'full_name',     p.full_name,
    'active_org_id', p.active_org_id,
    'orgs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'name', o.name, 'org_role', m.org_role,
        'verification_status', o.verification_status,
        'verification_note', o.verification_note,
        'services', coalesce((
          select jsonb_object_agg(sr.service_key, sr.role)
          from core.service_roles sr
          join core.org_services os
            on os.org_id = sr.org_id and os.service_key = sr.service_key and os.status in ('trial', 'active')
          where sr.org_id = o.id and sr.user_id = p.user_id
        ), '{}'::jsonb)))
      from core.memberships m
      join core.organizations o on o.id = m.org_id
      where m.user_id = p.user_id and m.status = 'active'
    ), '[]'::jsonb)
  )
  from core.profiles p
  where p.user_id = auth.uid()
$$;

-- Replaces the name-only version: every field is required, PAN is 9 digits (Nepal)
drop function core.create_organization(text, text);
create function core.create_organization(
  p_name text, p_slug text, p_address text, p_phone text, p_email text, p_pan_no text,
  p_owner_name text, p_owner_address text, p_owner_phone text, p_owner_email text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_address), '') = ''
     or coalesce(trim(p_owner_name), '') = '' or coalesce(trim(p_owner_address), '') = '' then
    raise exception 'name and address are required for the organization and the owner' using errcode = '22023';
  end if;
  if p_phone !~ '^\+?[0-9 ()-]{7,20}$' or p_owner_phone !~ '^\+?[0-9 ()-]{7,20}$' then
    raise exception 'enter valid phone numbers' using errcode = '22023';
  end if;
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or p_owner_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'enter valid email addresses' using errcode = '22023';
  end if;
  if p_pan_no !~ '^[0-9]{9}$' then
    raise exception 'PAN must be 9 digits' using errcode = '22023';
  end if;
  insert into core.organizations
    (name, slug, address, phone, email, pan_no, owner_name, owner_address, owner_phone, owner_email, created_by)
    values (trim(p_name), p_slug, trim(p_address), trim(p_phone), trim(p_email), p_pan_no,
            trim(p_owner_name), trim(p_owner_address), trim(p_owner_phone), trim(p_owner_email), auth.uid())
    returning id into v_org;
  insert into core.memberships (org_id, user_id, org_role) values (v_org, auth.uid(), 'owner');
  update core.profiles set active_org_id = v_org where user_id = auth.uid();
  return v_org;
end
$$;

revoke execute on function core.reset_verification(), core.org_verified(uuid), core.my_context(),
  core.create_organization(text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function core.org_verified(uuid), core.my_context(),
  core.create_organization(text, text, text, text, text, text, text, text, text, text)
  to authenticated, service_role;
