-- Sign-up collects a phone number; keep it on the profile
create or replace function core.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into core.profiles (user_id, full_name, phone)
    values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'phone');
  return new;
end
$$;
