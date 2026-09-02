-- Down for 20260101003500_exchange_chain.sql.
--
-- Run 20260101003600_record_return_chain_down.sql FIRST.
--
-- Rows created by a chained exchange cannot be represented once the column is
-- gone, so this refuses rather than silently orphaning them.

do $$
begin
  if exists (select 1 from public.return_items where source_return_item_id is not null) then
    raise exception
      'Returns exist against garments received in an exchange. Reverse them before rolling this back.';
  end if;
end
$$;

alter table public.return_items
  drop constraint if exists return_items_in_needs_a_source;

alter table public.return_items
  add constraint return_items_in_needs_sale_line check (
    (direction = 'in' and sale_item_id is not null)
    or (direction = 'out' and sale_item_id is null)
  );

drop index if exists public.return_items_source_idx;
alter table public.return_items drop column if exists source_return_item_id;
