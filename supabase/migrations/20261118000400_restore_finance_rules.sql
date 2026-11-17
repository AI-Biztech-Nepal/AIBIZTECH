-- Puts back the Finance row-security rules and logo-storage rules that 20261118000000 and 20261118000300 replaced.
-- The finance schema already existed with live data and its own rules (owner = the ACTIVE business, finance_current_owner()).
-- Those earlier files used a broader rule (any business the person has a Finance role in) and per-business logo folders.
-- This restores the original behaviour. Data is not touched. Safe to run more than once.
begin;

-- 1. The nine tables: owner sees the active business's rows only
do $$
declare t text;
begin
  foreach t in array array['customers','bank_accounts','account_transfers','expense_categories','finance_items','business_transactions','statement_imports'] loop
    execute format('drop policy if exists %I on finance.%I', t || '_all_owner', t);
    execute format('create policy %I on finance.%I for all using (owner_id = finance.finance_current_owner()) with check (owner_id = finance.finance_current_owner())', t || '_all_owner', t);
    execute format('drop policy if exists %I on finance.%I', t || '_admin_all', t);
    execute format('create policy %I on finance.%I for all using (finance.finance_is_admin()) with check (finance.finance_is_admin())', t || '_admin_all', t);
  end loop;

  foreach t in array array['customer_ledger_entries','vendor_ledger_entries'] loop
    execute format('drop policy if exists %I on finance.%I', t || '_select', t);
    execute format('create policy %I on finance.%I for select using (owner_id = finance.finance_current_owner())', t || '_select', t);
    execute format('drop policy if exists %I on finance.%I', t || '_insert_manual', t);
    execute format($f$create policy %I on finance.%I for insert with check (owner_id = finance.finance_current_owner() and source = 'manual')$f$, t || '_insert_manual', t);
    execute format('drop policy if exists %I on finance.%I', t || '_update_manual', t);
    execute format($f$create policy %I on finance.%I for update using (owner_id = finance.finance_current_owner() and source = 'manual') with check (owner_id = finance.finance_current_owner() and source = 'manual')$f$, t || '_update_manual', t);
    execute format('drop policy if exists %I on finance.%I', t || '_delete_manual', t);
    execute format($f$create policy %I on finance.%I for delete using (owner_id = finance.finance_current_owner() and source = 'manual')$f$, t || '_delete_manual', t);
    execute format('drop policy if exists %I on finance.%I', t || '_admin_all', t);
    execute format('create policy %I on finance.%I for all using (finance.finance_is_admin()) with check (finance.finance_is_admin())', t || '_admin_all', t);
  end loop;
end $$;

-- 2. Triggers that stamp the owner and keep updated_at: back on the original functions
do $$
declare t text;
begin
  foreach t in array array['customers','bank_accounts','account_transfers','expense_categories','finance_items','business_transactions','statement_imports','customer_ledger_entries','vendor_ledger_entries'] loop
    execute format('drop trigger if exists %I on finance.%I', t || '_stamp_owner', t);
    execute format('create trigger %I before insert on finance.%I for each row execute function finance.finance_stamp_owner()', t || '_stamp_owner', t);
  end loop;
  foreach t in array array['customers','bank_accounts','expense_categories','finance_items','business_transactions'] loop
    execute format('drop trigger if exists %I on finance.%I', t || '_touch', t);
    execute format('create trigger %I before update on finance.%I for each row execute function finance.finance_touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- 3. Logo storage: back to one folder per person (Finance's own migration 0011)
drop policy if exists business_assets_insert_own on storage.objects;
create policy business_assets_insert_own on storage.objects for insert with check (bucket_id = 'business-assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists business_assets_delete_own on storage.objects;
create policy business_assets_delete_own on storage.objects for delete using (bucket_id = 'business-assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists business_assets_update_own on storage.objects;

commit;
notify pgrst, 'reload schema';
