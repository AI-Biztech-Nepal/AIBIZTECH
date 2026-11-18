-- Spare parts stock in/out, done in one step so two people adjusting at once cannot lose a count.
begin;
create or replace function stock.adjust_part(p_part text, p_type text, p_qty int, p_reason text default null, p_notes text default null)
returns int language plpgsql security invoker set search_path = stock, core, public as $$
declare v_company text; v_name text; v_left int;
begin
  if p_type not in ('in','out') or coalesce(p_qty, 0) <= 0 then raise exception 'Enter a quantity above zero'; end if;
  update stock.spare_parts set quantity = coalesce(quantity, 0) + case when p_type = 'in' then p_qty else -p_qty end,
         updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
   where id = p_part and (p_type = 'in' or coalesce(quantity, 0) >= p_qty)
   returning company_id, name, quantity into v_company, v_name, v_left;
  if v_company is null then raise exception 'Part not found, or not enough in stock'; end if;
  insert into stock.part_transactions (id, company_id, part_id, part_name, type, quantity, reason, date, notes, created_at)
  values (gen_random_uuid()::text, v_company, p_part, v_name, p_type, p_qty, p_reason, to_char(now(), 'YYYY-MM-DD'), p_notes,
          to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  return v_left;
end $$;
grant execute on function stock.adjust_part(text, text, int, text, text) to authenticated;
commit;
notify pgrst, 'reload schema';
