-- Recording a collection, atomically (A-FR-9.7, A-FR-9.8).
--
-- One collection touches four tables: it creates the slip, links the lines it
-- covers, moves those lines to 'collected', and deducts stock. Done as four
-- PostgREST calls that is four transactions, and a failure halfway leaves the
-- shop with garments marked collected that stock still believes are on the
-- shelf -- or a slip that covers nothing. Here it is one statement that either
-- happens or does not.
--
-- security definer because it writes stock_movements and collection rows on
-- behalf of a seller who is not granted direct insert on them. The permission
-- checks RLS would have applied are therefore made explicitly, first.
--
-- Separate migration from 20260101001100 because that one adds the
-- 'collection' enum value, and Postgres will not let a value added in a
-- transaction be used by that same transaction.

create or replace function public.collect_order_lines(
  p_order_id       uuid,
  p_line_ids       uuid[],
  p_collector_name text,
  p_handed_over_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor    uuid := auth.uid();
  v_col_id   uuid;
  v_col_ref  text;
  v_expected integer := coalesce(array_length(p_line_ids, 1), 0);
  v_ready    integer;
  v_line     record;
begin
  if v_actor is null then
    raise exception 'Not signed in';
  end if;

  -- Administration is read-only (A-FR-2.2), so it may look at collections but
  -- not hand goods over.
  if not public.can_operate() then
    raise exception 'Your role cannot record a collection';
  end if;

  perform 1
  from public.orders o
  where o.id = p_order_id
    and (o.seller_id = v_actor or public.can_oversee());
  if not found then
    raise exception 'Order not found';
  end if;

  if v_expected = 0 then
    raise exception 'Select at least one line to collect';
  end if;

  if length(btrim(coalesce(p_collector_name, ''))) = 0 then
    raise exception 'The name of the person collecting is required';
  end if;

  perform 1 from public.profiles p where p.id = p_handed_over_by;
  if not found then
    raise exception 'Unknown member of staff for handed-over-by';
  end if;

  -- Every requested line must belong to THIS order and be Ready. Counting
  -- rather than trusting the caller closes two holes at once: collecting a line
  -- from somebody else's order, and collecting one that is still in production.
  select count(*) into v_ready
  from public.order_items oi
  where oi.id = any (p_line_ids)
    and oi.order_id = p_order_id
    and oi.status = 'ready';

  if v_ready <> v_expected then
    raise exception 'Every line must belong to this order and be Ready before collection';
  end if;

  insert into public.collections
    (order_id, collector_name, handed_over_by, created_by)
  values
    (p_order_id, btrim(p_collector_name), p_handed_over_by, v_actor)
  returning id, col_no into v_col_id, v_col_ref;

  -- collection_items.order_item_id is unique, so a line already covered by an
  -- earlier slip raises here rather than being handed over -- and deducted --
  -- twice.
  insert into public.collection_items (collection_id, order_item_id)
  select v_col_id, unnest(p_line_ids);

  -- Goes through enforce_order_line_transition(), which validates ready ->
  -- collected and writes the audit row. Collection needs no auditing of its
  -- own: it cannot move a line without that trigger recording it.
  update public.order_items
     set status = 'collected'
   where id = any (p_line_ids);

  -- The whole point of the issue: stock leaves HERE, not at order placement.
  --
  -- Lines with no product_id are free text -- a size the catalogue does not
  -- carry, which is often exactly why the parent ordered rather than bought --
  -- so there is nothing to deduct against and they are collected without a
  -- movement.
  --
  -- No check that stock is sufficient. Production entry does not exist yet, so
  -- levels are mostly zero and this will push them negative; refusing to hand
  -- over a garment the parent has already paid for is not an option at the
  -- counter. The movements are the truth and a stocktake reconciles later.
  for v_line in
    select oi.product_id, oi.quantity
    from public.order_items oi
    where oi.id = any (p_line_ids)
      and oi.product_id is not null
  loop
    insert into public.stock_movements
      (product_id, kind, quantity, collection_id, created_by, note)
    values
      (v_line.product_id, 'collection', -abs(v_line.quantity), v_col_id, v_actor,
       v_col_ref);
  end loop;

  return v_col_id;
end;
$fn$;

revoke all on function public.collect_order_lines(uuid, uuid[], text, uuid) from public;
grant execute on function public.collect_order_lines(uuid, uuid[], text, uuid) to authenticated;
