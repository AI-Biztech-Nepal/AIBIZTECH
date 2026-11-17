-- Buckets the legacy projects gained after the 2026-10-30 snapshot, with the same wall as service_storage:
-- files are only writable by members of the owning service (first folder = org id).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-photos', 'product-photos', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('employee-documents', 'employee-documents', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- Finance: product photos live under <org id>/...
drop policy if exists product_photos_select_public on storage.objects;
drop policy if exists product_photos_insert_own on storage.objects;
drop policy if exists product_photos_delete_own on storage.objects;
create policy product_photos_select_public on storage.objects for select using (bucket_id = 'product-photos');
create policy product_photos_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos' and (storage.foldername(name))[1] = finance.finance_current_owner()::text);
create policy product_photos_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'product-photos' and (storage.foldername(name))[1] = finance.finance_current_owner()::text);

-- Attendance: <company id>/<employee id>/...; admin/HR manage the company, an employee manages their own uploads.
drop policy if exists "employee-documents: admin or hr read" on storage.objects;
drop policy if exists "employee-documents: admin or hr upload" on storage.objects;
drop policy if exists "employee-documents: admin or hr delete" on storage.objects;
drop policy if exists "employee-documents: employee read own" on storage.objects;
drop policy if exists "employee-documents: employee upload own" on storage.objects;
drop policy if exists "employee-documents: employee delete own upload" on storage.objects;
create policy "employee-documents: admin or hr read" on storage.objects for select to authenticated
  using (bucket_id = 'employee-documents' and attendance.is_admin_or_hr() and (storage.foldername(name))[1] = attendance.my_company_id()::text);
create policy "employee-documents: admin or hr upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'employee-documents' and attendance.is_admin_or_hr() and (storage.foldername(name))[1] = attendance.my_company_id()::text);
create policy "employee-documents: admin or hr delete" on storage.objects for delete to authenticated
  using (bucket_id = 'employee-documents' and attendance.is_admin_or_hr() and (storage.foldername(name))[1] = attendance.my_company_id()::text);
create policy "employee-documents: employee read own" on storage.objects for select to authenticated
  using (bucket_id = 'employee-documents' and (storage.foldername(name))[1] = attendance.my_company_id()::text
    and (storage.foldername(name))[2] = (select p.employee_id::text from attendance.profiles p where p.id = auth.uid()));
create policy "employee-documents: employee upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'employee-documents' and (storage.foldername(name))[1] = attendance.my_company_id()::text
    and (storage.foldername(name))[2] = (select p.employee_id::text from attendance.profiles p where p.id = auth.uid()));
create policy "employee-documents: employee delete own upload" on storage.objects for delete to authenticated
  using (bucket_id = 'employee-documents' and (storage.foldername(name))[2] = (select p.employee_id::text from attendance.profiles p where p.id = auth.uid())
    and exists (select 1 from attendance.employee_documents d where d.file_path = objects.name and d.uploaded_by_employee
      and d.employee_id = (select p.employee_id from attendance.profiles p where p.id = auth.uid())));
