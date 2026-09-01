-- Recording a return or exchange, atomically (A-FR-8.1 to A-FR-8.6).
--
-- A return touches four tables: returns, return_items, stock_movements and
-- audit_log. Written one PostgREST call at a time that is four transactions --
-- and a failure halfway leaves a refund recorded with no garment back in stock,
-- or stock raised for a return that never got written. Money and inventory
-- disagreeing is the one outcome a shop cannot reconcile later. Here it lands
-- whole or not at all.
--
-- security definer because it writes audit_log, which operators cannot write
-- directly. The permission checks RLS would have applied are made explicitly,
-- first.
--
-- Separate migration from 20260101002800 because that one adds the 'exchange'
-- enum value, and Postgres will not let a value added in a transaction be used
-- by that same transaction.
--
-- p_in_items  is [{"sale_item_id": uuid, "quantity": int}, ...]
-- p_out_items is [{"product_id": uuid,  "quantity": int}, ...]
--
-- Note what the caller does NOT send: prices. Every price is looked up here.
-- What comes back is priced at what the parent actually paid, read from the
-- sale line; what goes out is priced from the catalogue. A client that could
-- name its own refund price could refund more than the garment ever cost.

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
  p_signature_url    text
)
returns table (id uuid, return_no text, refund_amount numeric, collected_amount numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor     uuid := auth.uid();
  v_return    uuid;
  v_reason    text := nullif(btrim(coalesce(p_reason, '')), '');
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

  -- Administration is read-only (A-FR-2.2).
  if not public.can_operate() then
    raise exception 'Your role cannot record a return';
  end if;

  if p_sale_id is null then
    raise exception 'A return must reference the original sale';
  end if;

  -- Aliased. The OUT parameters of `returns table (id ...)` are variables in
  -- scope for the whole body, so an unqualified `id` here is ambiguous between
  -- the column and that variable -- and Postgres says so at call time, not at
  -- creation time. Every column reference below is qualified for the same
  -- reason.
  if not exists (select 1 from public.sales s where s.id = p_sale_id) then
    raise exception 'That sale does not exist';
  end if;

  -- A-FR-8.3. The reason is what the out-of-policy report will be read back
  -- for, so "x" is not one.
  if v_reason is null or length(v_reason) < 3 then
    raise exception 'A return needs a reason';
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

  -- The header goes in first so the line trigger can read its sale_id, but the
  -- amounts are not known yet -- they are derived from the lines below and
  -- written back at the end.
  insert into public.returns (
    kind, sale_id, reason, condition,
    refund_method, collected_method,
    notes, signature_url,
    seller_id, recorded_by, received_by
  )
  values (
    p_kind, p_sale_id, v_reason, p_condition,
    p_refund_method, p_collected_method,
    nullif(btrim(coalesce(p_notes, '')), ''), p_signature_url,
    v_actor, v_actor, coalesce(p_received_by, v_actor)
  )
  returning returns.id into v_return;

  -- ------------------------------------------------------------- coming back
  for v_line in
    select (item ->> 'sale_item_id')::uuid as sale_item_id,
           (item ->> 'quantity')::integer  as quantity
    from jsonb_array_elements(p_in_items) as item
  loop
    if v_line.sale_item_id is null then
      raise exception 'Every returned line must name a line of the original sale';
    end if;
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Returned quantity must be greater than zero';
    end if;

    -- Priced from the SALE, not the catalogue: the parent gets back what they
    -- paid, which is not what the garment costs today.
    insert into public.return_items (
      return_id, direction, sale_item_id, product_id,
      description, size, unit_price, quantity, line_total
    )
    select v_return, 'in', si.id, si.product_id,
           si.description, si.size, si.unit_price, v_line.quantity,
           si.unit_price * v_line.quantity
    from public.sale_items si
    where si.id = v_line.sale_item_id;

    if not found then
      raise exception 'That sale line does not exist';
    end if;

    -- Back into sellable stock (A-FR-8.2). The quantity check that this line
    -- was actually sold, and has not already been given back, is enforced by
    -- the trigger on return_items above.
    insert into public.stock_movements (product_id, kind, quantity, return_id, note, created_by)
    select si.product_id, 'return', v_line.quantity, v_return, v_reason, v_actor
    from public.sale_items si
    where si.id = v_line.sale_item_id
      and si.product_id is not null;
  end loop;

  -- ---------------------------------------------------------- going back out
  if p_kind = 'exchange' then
    for v_line in
      select (item ->> 'product_id')::uuid as product_id,
             (item ->> 'quantity')::integer as quantity
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
             coalesce(p.name_en, p.name_fr), p.size, p.unit_price, v_line.quantity,
             p.unit_price * v_line.quantity
      from public.products p
      where p.id = v_line.product_id
        and p.is_active;

      if not found then
        raise exception 'That product is not available';
      end if;

      -- Leaves stock, but as an exchange rather than a sale: no money was taken
      -- for this garment, only for the difference, and the daily takings must
      -- not count it twice.
      insert into public.stock_movements (product_id, kind, quantity, return_id, note, created_by)
      values (v_line.product_id, 'exchange', -v_line.quantity, v_return, v_reason, v_actor);
    end loop;
  end if;

  -- ------------------------------------------------------------- the balance
  select coalesce(sum(line_total) filter (where direction = 'in'), 0),
         coalesce(sum(line_total) filter (where direction = 'out'), 0)
    into v_value_in, v_value_out
  from public.return_items
  where return_id = v_return;

  -- Derived, never typed. A-FR-8.1: same price moves no money, dearer collects
  -- the difference, cheaper refunds it.
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
         -- Dropped where nothing moved, so the row does not imply a payment
         -- that never happened.
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
      'value_in', v_value_in,
      'value_out', v_value_out,
      'refund_amount', v_refund,
      'refund_method', case when v_refund > 0 then p_refund_method end,
      'collected_amount', v_collect,
      'collected_method', case when v_collect > 0 then p_collected_method end
    )
  );

  return query
  select r.id, r.return_no, r.refund_amount, r.collected_amount
  from public.returns r
  where r.id = v_return;
end;
$fn$;

revoke all on function public.record_return(
  uuid, public.return_kind, text, public.garment_condition, jsonb, jsonb,
  public.payment_method, public.payment_method, uuid, text, text
) from public;

grant execute on function public.record_return(
  uuid, public.return_kind, text, public.garment_condition, jsonb, jsonb,
  public.payment_method, public.payment_method, uuid, text, text
) to authenticated;
