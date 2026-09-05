-- Stock per (product, size) — sizes leave the product (A-FR-4.2, A-FR-9.9).
--
-- A product used to be a garment PLUS a size, with its own stock row. It is now
-- just the garment; the size is chosen at the point of sale / order / exchange
-- from the configured set (app_size_config), and stock is tracked per
-- (product, size). The in-stock / reserved / available numbers become per-size.
--
-- Fresh start (agreed): the catalogue and every transaction are wiped, so the
-- re-key can add a NOT NULL size to empty tables and nothing has to be migrated
-- or guessed. This is destructive and irreversible for data; the down file
-- reverses the SCHEMA only.
--
-- WARNING: this migration has not been run against a live database. Apply it to
-- a disposable database and smoke-test the flows before go-live.

-- --------------------------------------------------------------- wipe
-- Cascade clears the children (sale_items, order_items, stock_movements,
-- stock_levels, product_prices_history, return_items, collection_items).
-- reference_counters is emptied too so references restart from 0001.
truncate table
  public.products,
  public.sales,
  public.orders,
  public.returns,
  public.collections,
  public.alterations,
  public.stock_movements,
  public.stock_levels,
  public.product_prices_history,
  public.reference_counters
  restart identity cascade;

-- --------------------------------------------------------------- schema
-- Size is no longer a product attribute.
alter table public.products drop column if exists size;

-- Every movement now names the size it moved. Default '' is a catch-all so a
-- path that forgets to pass a size lands in a visible bucket rather than
-- violating the (product_id, size) key below.
alter table public.stock_movements
  add column size text not null default '';

-- Re-key stock_levels from product to (product, size). Safe because the table
-- was just emptied.
alter table public.stock_levels drop constraint stock_levels_pkey;
alter table public.stock_levels
  add column size text not null default '';
alter table public.stock_levels
  add constraint stock_levels_pkey primary key (product_id, size);

-- The balance is still derived from the ledger, now keyed by (product, size).
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.stock_levels (product_id, size, quantity)
  values (new.product_id, new.size, new.quantity)
  on conflict (product_id, size) do update
    set quantity = public.stock_levels.quantity + excluded.quantity,
        updated_at = now();
  return new;
end;
$fn$;

-- --------------------------------------------------- record_production_batch
-- p_lines is now [{"product_id": uuid, "size": text, "quantity": int}, ...].
create or replace function public.record_production_batch(
  p_lines       jsonb,
  p_occurred_on date,
  p_tailor_name text,
  p_note        text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor    uuid := auth.uid();
  v_batch    uuid := gen_random_uuid();
  v_date     date := coalesce(p_occurred_on, current_date);
  v_tailor   text := nullif(btrim(coalesce(p_tailor_name, '')), '');
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_count    integer;
  v_total    integer;
  v_line     record;
begin
  if v_actor is null then
    raise exception 'Not signed in';
  end if;

  if not public.can_operate() then
    raise exception 'Your role cannot record production';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one line';
  end if;

  if v_date > current_date then
    raise exception 'Production cannot be dated in the future';
  end if;

  for v_line in
    select (item ->> 'product_id')::uuid as product_id,
           (item ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_lines) as item
  loop
    if v_line.product_id is null then
      raise exception 'Every line needs a product';
    end if;
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Quantity must be a whole number greater than zero';
    end if;

    perform 1 from public.products p
     where p.id = v_line.product_id and p.is_active;
    if not found then
      raise exception 'Unknown or inactive product on one of the lines';
    end if;
  end loop;

  insert into public.stock_movements
    (product_id, size, kind, quantity, occurred_on, tailor_name, note, batch_id, created_by)
  select (item ->> 'product_id')::uuid,
         coalesce(nullif(item ->> 'size', ''), ''),
         'production',
         (item ->> 'quantity')::integer,
         v_date,
         v_tailor,
         v_note,
         v_batch,
         v_actor
  from jsonb_array_elements(p_lines) as item;

  select count(*), coalesce(sum((item ->> 'quantity')::integer), 0)
    into v_count, v_total
    from jsonb_array_elements(p_lines) as item;

  insert into public.audit_log (actor_id, action, entity, meta)
  values (
    v_actor,
    'production_recorded',
    v_batch::text,
    jsonb_build_object(
      'batch_id',    v_batch,
      'occurred_on', v_date,
      'tailor_name', v_tailor,
      'note',        v_note,
      'line_count',  v_count,
      'total_units', v_total,
      'lines',       p_lines
    )
  );

  return v_batch;
end;
$fn$;

revoke all on function public.record_production_batch(jsonb, date, text, text) from public;
grant execute on function public.record_production_batch(jsonb, date, text, text) to authenticated;

-- ------------------------------------------------------ collect_order_lines
-- The deduction at collection now carries the order line's size.
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

  insert into public.collection_items (collection_id, order_item_id)
  select v_col_id, unnest(p_line_ids);

  update public.order_items
     set status = 'collected'
   where id = any (p_line_ids);

  for v_line in
    select oi.product_id, oi.size, oi.quantity
    from public.order_items oi
    where oi.id = any (p_line_ids)
      and oi.product_id is not null
  loop
    insert into public.stock_movements
      (product_id, size, kind, quantity, collection_id, created_by, note)
    values
      (v_line.product_id, coalesce(v_line.size, ''), 'collection', -abs(v_line.quantity),
       v_col_id, v_actor, v_col_ref);
  end loop;

  return v_col_id;
end;
$fn$;

revoke all on function public.collect_order_lines(uuid, uuid[], text, uuid) from public;
grant execute on function public.collect_order_lines(uuid, uuid[], text, uuid) to authenticated;

-- --------------------------------------------------------------- cancel_sale
-- Reversal mirrors the original movements, size included.
create or replace function public.cancel_sale(p_sale_id uuid, p_reason text)
returns table (id uuid, receipt_no text)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor  uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_sale   record;
begin
  if v_actor is null then
    raise exception 'Not signed in';
  end if;

  if not public.can_operate() then
    raise exception 'Your role cannot cancel a sale';
  end if;

  if v_reason is null or length(v_reason) < 3 then
    raise exception 'Cancelling a sale requires a reason';
  end if;

  select s.id, s.receipt_no, s.cancelled_at
    into v_sale
    from public.sales s
   where s.id = p_sale_id
   for update;

  if not found then
    raise exception 'That sale does not exist';
  end if;
  if v_sale.cancelled_at is not null then
    raise exception 'That sale is already cancelled';
  end if;

  if exists (select 1 from public.returns r where r.sale_id = p_sale_id) then
    raise exception 'This sale has a return against it; cancel is not available';
  end if;

  update public.sales
     set cancelled_at  = now(),
         cancelled_by  = v_actor,
         cancel_reason = v_reason
   where public.sales.id = p_sale_id;

  insert into public.stock_movements (product_id, size, kind, quantity, sale_id, note, created_by)
  select sm.product_id, sm.size, 'sale', -sm.quantity, p_sale_id,
         'Sale ' || v_sale.receipt_no || ' cancelled: ' || v_reason, v_actor
    from public.stock_movements sm
   where sm.sale_id = p_sale_id
     and sm.kind = 'sale';

  insert into public.audit_log (actor_id, action, entity, target_table, target_id, meta)
  values (
    v_actor,
    'sale_cancelled',
    v_sale.receipt_no,
    'sales',
    p_sale_id::text,
    jsonb_build_object('receipt_no', v_sale.receipt_no, 'reason', v_reason)
  );

  return query
  select s.id, s.receipt_no from public.sales s where s.id = p_sale_id;
end;
$fn$;

revoke all on function public.cancel_sale(uuid, text) from public;
grant execute on function public.cancel_sale(uuid, text) to authenticated;

-- ------------------------------------------------------------- record_return
-- Incoming lines carry the size the garment was sold / handed over at; the
-- outgoing (exchange) line carries the size chosen at the counter, from
-- p_out_items ("size"), since the product no longer has one.
create or replace function public.record_return(
  p_sale_id          uuid,
  p_kind             public.return_kind,
  p_reason           text,
  p_condition        public.garment_condition,
  p_in_items         jsonb,
  p_out_items        jsonb,
  p_refund_method    public.payment_method,
  p_collected_method public.payment_method,
  p_received_by      uuid,
  p_notes            text,
  p_signature_url    text,
  p_override_reason  text default null
)
returns table (
  id uuid,
  return_no text,
  refund_amount numeric,
  collected_amount numeric,
  within_policy boolean,
  elapsed_days integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor     uuid := auth.uid();
  v_return    uuid;
  v_reason    text := nullif(btrim(coalesce(p_reason, '')), '');
  v_override  text := nullif(btrim(coalesce(p_override_reason, '')), '');
  v_sold_at   timestamptz;
  v_elapsed   integer;
  v_window    integer;
  v_within    boolean;
  v_value_in  numeric(12, 2) := 0;
  v_value_out numeric(12, 2) := 0;
  v_diff      numeric(12, 2);
  v_refund    numeric(12, 2) := 0;
  v_collect   numeric(12, 2) := 0;
  v_line      record;
begin
  if v_actor is null then
    raise exception 'Not signed in';
  end if;

  if not public.can_operate() then
    raise exception 'Your role cannot record a return';
  end if;

  if p_sale_id is null then
    raise exception 'A return must reference the original sale';
  end if;

  select s.sold_at into v_sold_at from public.sales s where s.id = p_sale_id;
  if v_sold_at is null then
    raise exception 'That sale does not exist';
  end if;

  if v_reason is null or length(v_reason) < 3 then
    raise exception 'A return needs a reason';
  end if;

  select v.elapsed_days, v.window_days, v.within_policy
    into v_elapsed, v_window, v_within
  from public.return_policy_verdict(v_sold_at, p_kind, p_condition) v;

  if not v_within and v_override is null then
    raise exception
      'This is outside the % policy (% days since the sale, window %). Give a reason to proceed.',
      p_kind, v_elapsed, coalesce(v_window::text, 'not permitted');
  end if;

  if p_in_items is null
     or jsonb_typeof(p_in_items) <> 'array'
     or jsonb_array_length(p_in_items) = 0 then
    raise exception 'Add at least one garment being returned';
  end if;

  if p_kind = 'exchange'
     and (p_out_items is null
          or jsonb_typeof(p_out_items) <> 'array'
          or jsonb_array_length(p_out_items) = 0) then
    raise exception 'An exchange needs at least one garment going out';
  end if;

  if p_kind = 'return'
     and p_out_items is not null
     and jsonb_typeof(p_out_items) = 'array'
     and jsonb_array_length(p_out_items) > 0 then
    raise exception 'A return takes nothing out. Record an exchange instead.';
  end if;

  insert into public.returns (
    kind, sale_id, reason, condition,
    refund_method, collected_method,
    notes, signature_url,
    seller_id, recorded_by, received_by,
    elapsed_days, policy_window_days, within_policy, override_reason
  )
  values (
    p_kind, p_sale_id, v_reason, p_condition,
    p_refund_method, p_collected_method,
    nullif(btrim(coalesce(p_notes, '')), ''), p_signature_url,
    v_actor, v_actor, coalesce(p_received_by, v_actor),
    v_elapsed, v_window, v_within, case when not v_within then v_override end
  )
  returning returns.id into v_return;

  -- ------------------------------------------------------------- coming back
  for v_line in
    select (item ->> 'sale_item_id')::uuid           as sale_item_id,
           (item ->> 'source_return_item_id')::uuid  as source_return_item_id,
           (item ->> 'quantity')::integer            as quantity
    from jsonb_array_elements(p_in_items) as item
  loop
    if (v_line.sale_item_id is null) = (v_line.source_return_item_id is null) then
      raise exception
        'Every returned line must name either a line of the original sale or a garment handed over in an exchange';
    end if;
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Returned quantity must be greater than zero';
    end if;

    if v_line.sale_item_id is not null then
      insert into public.return_items (
        return_id, direction, sale_item_id, source_return_item_id, product_id,
        description, size, unit_price, quantity, line_total
      )
      select v_return, 'in', si.id, null, si.product_id,
             si.description, si.size, si.unit_price, v_line.quantity,
             si.unit_price * v_line.quantity
      from public.sale_items si
      where si.id = v_line.sale_item_id;

      if not found then
        raise exception 'That sale line does not exist';
      end if;

      insert into public.stock_movements (product_id, size, kind, quantity, return_id, note, created_by)
      select si.product_id, coalesce(si.size, ''), 'return', v_line.quantity, v_return, v_reason, v_actor
      from public.sale_items si
      where si.id = v_line.sale_item_id
        and si.product_id is not null;
    else
      insert into public.return_items (
        return_id, direction, sale_item_id, source_return_item_id, product_id,
        description, size, unit_price, quantity, line_total
      )
      select v_return, 'in', null, src.id, src.product_id,
             src.description, src.size, src.unit_price, v_line.quantity,
             src.unit_price * v_line.quantity
      from public.return_items src
      where src.id = v_line.source_return_item_id
        and src.direction = 'out';

      if not found then
        raise exception 'That line was never handed over in an exchange';
      end if;

      insert into public.stock_movements (product_id, size, kind, quantity, return_id, note, created_by)
      select src.product_id, coalesce(src.size, ''), 'return', v_line.quantity, v_return, v_reason, v_actor
      from public.return_items src
      where src.id = v_line.source_return_item_id;
    end if;
  end loop;

  -- ---------------------------------------------------------- going back out
  if p_kind = 'exchange' then
    for v_line in
      select (item ->> 'product_id')::uuid  as product_id,
             nullif(item ->> 'size', '')     as size,
             (item ->> 'quantity')::integer  as quantity
      from jsonb_array_elements(p_out_items) as item
    loop
      if v_line.product_id is null then
        raise exception 'Every outgoing line needs a product';
      end if;
      if v_line.quantity is null or v_line.quantity <= 0 then
        raise exception 'Outgoing quantity must be greater than zero';
      end if;

      insert into public.return_items (
        return_id, direction, sale_item_id, product_id,
        description, size, unit_price, quantity, line_total
      )
      select v_return, 'out', null, p.id,
             coalesce(p.name_en, p.name_fr), v_line.size, p.unit_price, v_line.quantity,
             p.unit_price * v_line.quantity
      from public.products p
      where p.id = v_line.product_id
        and p.is_active;

      if not found then
        raise exception 'That product is not available';
      end if;

      insert into public.stock_movements (product_id, size, kind, quantity, return_id, note, created_by)
      values (v_line.product_id, coalesce(v_line.size, ''), 'exchange', -v_line.quantity,
              v_return, v_reason, v_actor);
    end loop;
  end if;

  -- ------------------------------------------------------------- the balance
  select coalesce(sum(ri.line_total) filter (where ri.direction = 'in'), 0),
         coalesce(sum(ri.line_total) filter (where ri.direction = 'out'), 0)
    into v_value_in, v_value_out
  from public.return_items ri
  where ri.return_id = v_return;

  v_diff := v_value_out - v_value_in;
  if v_diff > 0 then
    v_collect := v_diff;
  elsif v_diff < 0 then
    v_refund := -v_diff;
  end if;

  if v_refund > 0 and p_refund_method is null then
    raise exception 'Choose how the refund is being paid';
  end if;
  if v_collect > 0 and p_collected_method is null then
    raise exception 'Choose how the difference is being collected';
  end if;

  update public.returns
     set refund_amount    = v_refund,
         collected_amount = v_collect,
         refund_method    = case when v_refund  > 0 then p_refund_method    end,
         collected_method = case when v_collect > 0 then p_collected_method end
   where returns.id = v_return;

  insert into public.audit_log (actor_id, action, entity, target_table, target_id, meta)
  values (
    v_actor,
    case when p_kind = 'exchange' then 'exchange_recorded' else 'return_recorded' end,
    v_return::text,
    'returns',
    v_return::text,
    jsonb_build_object(
      'sale_id', p_sale_id,
      'reason', v_reason,
      'condition', p_condition,
      'elapsed_days', v_elapsed,
      'policy_window_days', v_window,
      'within_policy', v_within,
      'value_in', v_value_in,
      'value_out', v_value_out,
      'refund_amount', v_refund,
      'refund_method', case when v_refund > 0 then p_refund_method end,
      'collected_amount', v_collect,
      'collected_method', case when v_collect > 0 then p_collected_method end
    )
  );

  if not v_within then
    insert into public.audit_log (
      actor_id, actor_name, action, entity, target_table, target_id, meta
    )
    select
      v_actor,
      p.full_name,
      'return_policy_override',
      r.return_no,
      'returns',
      v_return::text,
      jsonb_build_object(
        'return_no', r.return_no,
        'kind', p_kind,
        'condition', p_condition,
        'elapsed_days', v_elapsed,
        'policy_window_days', v_window,
        'override_reason', v_override,
        'refund_amount', v_refund,
        'collected_amount', v_collect
      )
    from public.returns r
    left join public.profiles p on p.id = v_actor
    where r.id = v_return;
  end if;

  return query
  select r.id, r.return_no, r.refund_amount, r.collected_amount,
         r.within_policy, r.elapsed_days
  from public.returns r
  where r.id = v_return;
end;
$fn$;

revoke all on function public.record_return(
  uuid, public.return_kind, text, public.garment_condition, jsonb, jsonb,
  public.payment_method, public.payment_method, uuid, text, text, text
) from public;

grant execute on function public.record_return(
  uuid, public.return_kind, text, public.garment_condition, jsonb, jsonb,
  public.payment_method, public.payment_method, uuid, text, text, text
) to authenticated;
