-- A garment received in an exchange can be given back too (A-FR-8.13).
--
-- Until now an incoming line had to name a row of sale_items, so only something
-- originally BOUGHT could come back. A replacement garment is a return_items
-- row with direction 'out' -- it has no sale line, so it could never be
-- returned. A parent who swapped M for L and found L also wrong was stuck, on
-- day one, inside every window.
--
-- That was stricter than the requirement intends. A-FR-8.13's worry is that
-- "a garment can be exchanged indefinitely", and the answer to that is the
-- clock, not a prohibition: the elapsed time keeps running from the ORIGINAL
-- sale however many times the garment is swapped. The second exchange is
-- allowed; it is simply judged against the same deadline as the first.

-- --------------------------------------------------------------- the link
--
-- An incoming line now names either the sale line it was bought on, or the
-- outgoing line it was received on. Never both, and never neither.
alter table public.return_items
  add column source_return_item_id uuid references public.return_items (id) on delete restrict;

create index return_items_source_idx
  on public.return_items (source_return_item_id)
  where source_return_item_id is not null;

-- Replaces the constraint from 20260101002800, which required sale_item_id on
-- every incoming line.
alter table public.return_items
  drop constraint if exists return_items_in_needs_sale_line;

alter table public.return_items
  add constraint return_items_in_needs_a_source check (
    (direction = 'in' and (sale_item_id is not null) <> (source_return_item_id is not null))
    or (direction = 'out' and sale_item_id is null and source_return_item_id is null)
  );

-- ------------------------------------------------- how much is still returnable
--
-- Rewritten to answer the same question for both kinds of source: how many of
-- this garment did the parent receive, and how many have they already given
-- back. Without it a return refunds money for goods that were never handed over
-- -- by over-returning a line, or by returning the same one twice.
--
-- security definer so the check still runs for a caller who may insert a return
-- line but cannot read every sale line.
create or replace function public.enforce_returnable_quantity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_received  integer;
  v_returned  integer;
  v_owner     uuid;      -- the sale this line's history belongs to
  v_this_sale uuid;
begin
  if new.direction <> 'in' then
    return new;
  end if;

  select r.sale_id into v_this_sale
  from public.returns r
  where r.id = new.return_id;

  if new.sale_item_id is not null then
    -- Bought outright: the sale line says how many were received.
    select si.quantity, si.sale_id into v_received, v_owner
    from public.sale_items si
    where si.id = new.sale_item_id;

    if v_received is null then
      raise exception 'That sale line does not exist';
    end if;

    select coalesce(sum(ri.quantity), 0) into v_returned
    from public.return_items ri
    where ri.sale_item_id = new.sale_item_id
      and ri.direction = 'in'
      and ri.id is distinct from new.id;
  else
    -- Received in an exchange: the outgoing line says how many were handed over,
    -- and the return it belongs to says which sale the whole chain descends
    -- from. Following that back is what keeps the clock on the original sale
    -- however long the chain gets.
    select src.quantity, r.sale_id into v_received, v_owner
    from public.return_items src
    join public.returns r on r.id = src.return_id
    where src.id = new.source_return_item_id
      and src.direction = 'out';

    if v_received is null then
      raise exception 'That line was never handed over in an exchange';
    end if;

    select coalesce(sum(ri.quantity), 0) into v_returned
    from public.return_items ri
    where ri.source_return_item_id = new.source_return_item_id
      and ri.direction = 'in'
      and ri.id is distinct from new.id;
  end if;

  -- The line has to belong to the sale this return is against, or a return
  -- could quietly refund against someone else's purchase.
  if v_owner is distinct from v_this_sale then
    raise exception 'That line belongs to a different sale';
  end if;

  if v_returned + new.quantity > v_received then
    raise exception
      'Only % of that item remain returnable (% received, % already returned).',
      v_received - v_returned, v_received, v_returned;
  end if;

  return new;
end;
$fn$;
