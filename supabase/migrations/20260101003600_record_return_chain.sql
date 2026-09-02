-- record_return() accepts a garment received in an earlier exchange (A-FR-8.13).
--
-- Replaces the body from 20260101003200. The signature is unchanged, so this is
-- a plain `create or replace` -- no drop, no PostgREST ambiguity.
--
-- p_in_items entries now carry EITHER "sale_item_id" (bought outright) or
-- "source_return_item_id" (received in an exchange). The quantity check that
-- decides how many remain returnable lives in the trigger on return_items and
-- handles both.
--
-- The clock does not move. `returns.sale_id` is still the ORIGINAL sale, and the
-- verdict is still computed from its sold_at, however many times the garment has
-- been swapped -- which is precisely what A-FR-8.13 asks for.

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
  -- Required only when the verdict says out of policy. The form asks for it
  -- once the warning appears; the check below is what makes it mandatory.
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

  -- Administration is read-only (A-FR-2.2).
  if not public.can_operate() then
    raise exception 'Your role cannot record a return';
  end if;

  if p_sale_id is null then
    raise exception 'A return must reference the original sale';
  end if;

  -- Aliased: the OUT parameters are variables in scope for the whole body, so
  -- an unqualified `id` here would be ambiguous between column and variable.
  select s.sold_at into v_sold_at from public.sales s where s.id = p_sale_id;
  if v_sold_at is null then
    raise exception 'That sale does not exist';
  end if;

  if v_reason is null or length(v_reason) < 3 then
    raise exception 'A return needs a reason';
  end if;

  -- --------------------------------------------------------- the verdict
  --
  -- Computed from the ORIGINAL sale date (A-FR-8.13). An exchange does not
  -- restart the clock, or a garment could be swapped indefinitely.
  select v.elapsed_days, v.window_days, v.within_policy
    into v_elapsed, v_window, v_within
  from public.return_policy_verdict(v_sold_at, p_kind, p_condition) v;

  -- The seller was warned on screen and asked to explain. This is the same rule
  -- applied where it cannot be skipped -- a direct PostgREST call never sees
  -- the form. It refuses the MISSING EXPLANATION, never the return itself.
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

  -- The verdict is stored, not recomputed on read: the windows are editable, so
  -- a return judged in-policy today would silently become an override the
  -- moment someone shortens a window.
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
    -- Exactly one source. Neither means there is nothing to price the refund
    -- against; both would mean two different histories for one garment.
    if (v_line.sale_item_id is null) = (v_line.source_return_item_id is null) then
      raise exception
        'Every returned line must name either a line of the original sale or a garment handed over in an exchange';
    end if;
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Returned quantity must be greater than zero';
    end if;

    if v_line.sale_item_id is not null then
      -- Priced from the SALE, not the catalogue: the parent gets back what they
      -- paid, which is not what the garment costs today.
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

      insert into public.stock_movements (product_id, kind, quantity, return_id, note, created_by)
      select si.product_id, 'return', v_line.quantity, v_return, v_reason, v_actor
      from public.sale_items si
      where si.id = v_line.sale_item_id
        and si.product_id is not null;
    else
      -- Priced from the OUTGOING line it was received on -- what the garment was
      -- valued at when it was handed over, which is what the exchange
      -- difference was settled against.
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

      insert into public.stock_movements (product_id, kind, quantity, return_id, note, created_by)
      select src.product_id, 'return', v_line.quantity, v_return, v_reason, v_actor
      from public.return_items src
      where src.id = v_line.source_return_item_id;
    end if;
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
      -- for this garment, only for the difference.
      insert into public.stock_movements (product_id, kind, quantity, return_id, note, created_by)
      values (v_line.product_id, 'exchange', -v_line.quantity, v_return, v_reason, v_actor);
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

  -- A second row, only for an override, with its own action name.
  --
  -- The transaction row above already carries within_policy, but "how often is
  -- the rule being set aside, and by whom" (A-FR-8.12) is a question about
  -- DECISIONS, not transactions. Giving it its own action means the audit
  -- screen can filter to exactly that, the way sale_below_stock_override
  -- already does for the equivalent decision on a sale.
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
