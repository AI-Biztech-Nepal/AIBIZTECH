-- Private bucket for PAN card photos. Path: <org_id>/<file>. Members read; owners and admins upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pan-cards', 'pan-cards', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy pan_cards_read on storage.objects for select to authenticated
  using (bucket_id = 'pan-cards' and core.org_role(((storage.foldername(name))[1])::uuid) is not null);
create policy pan_cards_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'pan-cards' and core.is_org_admin(((storage.foldername(name))[1])::uuid));
create policy pan_cards_update on storage.objects for update to authenticated
  using (bucket_id = 'pan-cards' and core.is_org_admin(((storage.foldername(name))[1])::uuid));
