-- Attendance (services/attendance/supabase/003_auth_signup.sql) also names its trigger on auth.users
-- "on_auth_user_created". On a shared database only one can exist, so portal accounts got no core.profiles
-- row and were sent back to sign-in. The portal now uses its own trigger name. Safe to run more than once.
begin;

create or replace function core.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into core.profiles (user_id, full_name, phone)
    values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'phone')
    on conflict (user_id) do nothing;
  return new;
end
$$;

drop trigger if exists portal_on_auth_user_created on auth.users;
create trigger portal_on_auth_user_created
  after insert on auth.users
  for each row execute function core.handle_new_user();

-- Accounts that already exist without a portal profile
insert into core.profiles (user_id, full_name, phone)
  select u.id, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'phone' from auth.users u
  on conflict (user_id) do nothing;

commit;
