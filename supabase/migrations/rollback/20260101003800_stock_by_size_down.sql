-- Down for 20260101003800_stock_by_size.sql.
--
-- Reverses the SCHEMA only. The data wipe in the up migration is irreversible;
-- restore from a backup if you need the rows back. The four movement functions
-- are restored to their size-free bodies (their definitions from 001200 / 001400
-- / 003300 / 003600), because once stock_movements.size is dropped the size-aware
-- versions would reference a column that no longer exists.

-- --------------------------------------------------------------- schema back
alter table public.products add column if not exists size text;

alter table public.stock_levels drop constraint stock_levels_pkey;
alter table public.stock_levels drop column if exists size;
alter table public.stock_levels add constraint stock_levels_pkey primary key (product_id);

alter table public.stock_movements drop column if exists size;

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.stock_levels (product_id, quantity)
  values (new.product_id, new.quantity)
  on conflict (product_id) do update
    set quantity = public.stock_levels.quantity + excluded.quantity,
        updated_at = now();
  return new;
end;
$fn$;

-- ---------------------------------------------- record_production_batch (size-free)
create or replace function public.record_production_batch(
  p_lines jsonb, p_occurred_on date, p_tailor_name text, p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor  uuid := auth.uid();
  v_batch  uuid := gen_random_uuid();
  v_date   date := coalesce(p_occurred_on, current_date);
  v_tailor text := nullif(btrim(coalesce(p_tailor_name, '')), '');
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
  v_count  integer;
  v_total  integer;
  v_line   record;
begin
  if v_actor is null then raise exception 'Not signed in'; end if;
  if not public.can_operate() then raise exception 'Your role cannot record production'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one line';
  end if;
  if v_date > current_date then raise exception 'Production cannot be dated in the future'; end if;

  for v_line in
    select (item ->> 'product_id')::uuid as product_id, (item ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_lines) as item
  loop
    if v_line.product_id is null then raise exception 'Every line needs a product'; end if;
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Quantity must be a whole number greater than zero';
    end if;
    perform 1 from public.products p where p.id = v_line.product_id and p.is_active;
    if not found then raise exception 'Unknown or inactive product on one of the lines'; end if;
  end loop;

  insert into public.stock_movements
    (product_id, kind, quantity, occurred_on, tailor_name, note, batch_id, created_by)
  select (item ->> 'product_id')::uuid, 'production', (item ->> 'quantity')::integer,
         v_date, v_tailor, v_note, v_batch, v_actor
  from jsonb_array_elements(p_lines) as item;

  select count(*), coalesce(sum((item ->> 'quantity')::integer), 0)
    into v_count, v_total from jsonb_array_elements(p_lines) as item;

  insert into public.audit_log (actor_id, action, entity, meta)
  values (v_actor, 'production_recorded', v_batch::text,
    jsonb_build_object('batch_id', v_batch, 'occurred_on', v_date, 'tailor_name', v_tailor,
      'note', v_note, 'line_count', v_count, 'total_units', v_total, 'lines', p_lines));
  return v_batch;
end;
$fn$;

-- ------------------------------------------------ collect_order_lines (size-free)
create or replace function public.collect_order_lines(
  p_order_id uuid, p_line_ids uuid[], p_collector_name text, p_handed_over_by uuid
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
  if v_actor is null then raise exception 'Not signed in'; end if;
  if not public.can_operate() then raise exception 'Your role cannot record a collection'; end if;
  perform 1 from public.orders o where o.id = p_order_id and (o.seller_id = v_actor or public.can_oversee());
  if not found then raise exception 'Order not found'; end if;
  if v_expected = 0 then raise exception 'Select at least one line to collect'; end if;
  if length(btrim(coalesce(p_collector_name, ''))) = 0 then
    raise exception 'The name of the person collecting is required';
  end if;
  perform 1 from public.profiles p where p.id = p_handed_over_by;
  if not found then raise exception 'Unknown member of staff for handed-over-by'; end if;

  select count(*) into v_ready from public.order_items oi
  where oi.id = any (p_line_ids) and oi.order_id = p_order_id and oi.status = 'ready';
  if v_ready <> v_expected then
    raise exception 'Every line must belong to this order and be Ready before collection';
  end if;

  insert into public.collections (order_id, collector_name, handed_over_by, created_by)
  values (p_order_id, btrim(p_collector_name), p_handed_over_by, v_actor)
  returning id, col_no into v_col_id, v_col_ref;

  insert into public.collection_items (collection_id, order_item_id)
  select v_col_id, unnest(p_line_ids);

  update public.order_items set status = 'collected' where id = any (p_line_ids);

  for v_line in
    select oi.product_id, oi.quantity from public.order_items oi
    where oi.id = any (p_line_ids) and oi.product_id is not null
  loop
    insert into public.stock_movements (product_id, kind, quantity, collection_id, created_by, note)
    values (v_line.product_id, 'collection', -abs(v_line.quantity), v_col_id, v_actor, v_col_ref);
  end loop;

  return v_col_id;
end;
$fn$;

-- NOTE: cancel_sale and record_return also reference stock_movements.size in
-- their up-migration bodies. Restore them from their original migrations
-- (20260101003300_sale_cancellation.sql and 20260101003600_record_return_chain.sql)
-- when rolling back -- their bodies are reproduced verbatim there, and copying
-- them here would only create a second source of truth to keep in step.
