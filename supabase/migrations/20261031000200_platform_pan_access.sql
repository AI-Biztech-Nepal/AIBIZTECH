-- Platform staff can open any organization's PAN card photo while reviewing it.
create policy pan_cards_platform_read on storage.objects for select to authenticated
  using (bucket_id = 'pan-cards' and core.is_platform_admin());
