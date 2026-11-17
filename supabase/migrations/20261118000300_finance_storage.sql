-- Company logo bucket for Finance (folder = the business id). Separate file because it needs Supabase's storage schema.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('business-assets', 'business-assets', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

drop policy if exists business_assets_insert_own on storage.objects;
create policy business_assets_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'business-assets' and finance.can_use(((storage.foldername(name))[1])::uuid));
drop policy if exists business_assets_select_public on storage.objects;
create policy business_assets_select_public on storage.objects for select using (bucket_id = 'business-assets');
drop policy if exists business_assets_delete_own on storage.objects;
create policy business_assets_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'business-assets' and finance.can_use(((storage.foldername(name))[1])::uuid));
drop policy if exists business_assets_update_own on storage.objects;
create policy business_assets_update_own on storage.objects for update to authenticated
  using (bucket_id = 'business-assets' and finance.can_use(((storage.foldername(name))[1])::uuid));
