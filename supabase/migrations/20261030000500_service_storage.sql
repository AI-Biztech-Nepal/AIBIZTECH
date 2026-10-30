-- Storage buckets moved from the legacy Finance and Attendance projects, with the wall applied:
-- files are only writable by members of the owning service, instead of "any signed-in user".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('business-assets',    'business-assets',    true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('attendance-selfies', 'attendance-selfies', true, null,    null)
on conflict (id) do nothing;

-- Finance: logos live under <org id>/...
create policy business_assets_select_public on storage.objects for select using (bucket_id = 'business-assets');
create policy business_assets_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'business-assets' and (storage.foldername(name))[1] = finance.finance_current_owner()::text);
create policy business_assets_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'business-assets' and (storage.foldername(name))[1] = finance.finance_current_owner()::text);

-- Attendance: public read stays (employee photos are shown by URL); writes need an attendance role in the active org.
create policy attendance_selfies_select_public on storage.objects for select using (bucket_id = 'attendance-selfies');
create policy attendance_selfies_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'attendance-selfies' and attendance.my_company_id() is not null);
create policy attendance_selfies_update on storage.objects for update to authenticated
  using (bucket_id = 'attendance-selfies' and attendance.my_company_id() is not null)
  with check (bucket_id = 'attendance-selfies' and attendance.my_company_id() is not null);
