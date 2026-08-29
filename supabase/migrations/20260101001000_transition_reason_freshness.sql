-- Require the transition reason to be supplied FOR THE MOVE BEING MADE.
--
-- 20260101000900 shipped this function checking only that `status_reason` was
-- non-empty. An UPDATE that touches `status` alone inherits whatever reason an
-- earlier transition left in the column, so a cancellation could pass the check
-- carrying a step-back's explanation from days earlier -- and the audit row
-- would then record a reason belonging to a different event. An audit trail
-- that confidently states the wrong reason is worse than one that states none.
--
-- The fix is `new.status_reason is distinct from old.status_reason`. This
-- migration exists rather than an edit to 20260101000900 because that one has
-- already been applied; the function body below is identical to the one there,
-- so a fresh database and a migrated one end up in the same place.

create or replace function public.enforce_order_line_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_from      public.order_status := old.status;
  v_to        public.order_status := new.status;
  v_from_rank integer;
  v_to_rank   integer;
  v_reason    text := nullif(btrim(coalesce(new.status_reason, '')), '');
  -- A reason must be supplied FOR THIS MOVE. Without this, an UPDATE that only
  -- touches `status` inherits whatever reason an earlier transition left in the
  -- column, and the audit row then records an explanation belonging to a
  -- different event -- which is worse than no reason at all.
  v_fresh     boolean := new.status_reason is distinct from old.status_reason;
  v_order_no  text;
begin
  if v_to is not distinct from v_from then
    return new;
  end if;

  if v_from is null then
    raise exception 'A line handed over immediately has no status to change';
  end if;
  if v_to is null then
    raise exception 'An outstanding line cannot drop its status';
  end if;
  if v_from = 'collected' then
    raise exception 'A collected line cannot change status -- record a return instead';
  end if;
  if v_from = 'cancelled' then
    raise exception 'A cancelled line cannot change status';
  end if;

  if v_to = 'cancelled' then
    if v_reason is null or not v_fresh then
      raise exception 'Cancelling a line requires a reason';
    end if;
    if new.refund_method is null then
      raise exception 'Cancelling a line requires the refund method';
    end if;
    -- Stamped here, not by the caller, so it records when the database accepted
    -- the cancellation rather than when a browser claims it happened.
    new.cancelled_at := now();
    new.cancelled_by := auth.uid();
  else
    v_from_rank := public.order_status_rank(v_from);
    v_to_rank   := public.order_status_rank(v_to);

    if v_to_rank = v_from_rank + 1 then
      null;                                    -- forward, one tap
    elsif v_to_rank = v_from_rank - 1 then
      if v_reason is null or not v_fresh then
        raise exception 'Moving a line backwards requires a reason';
      end if;
    else
      raise exception 'Illegal transition: % -> %', v_from, v_to;
    end if;
  end if;

  select o.order_no into v_order_no from public.orders o where o.id = new.order_id;

  insert into public.audit_log (actor_id, action, entity, meta)
  values (
    auth.uid(),
    'order_line_status_changed',
    coalesce(v_order_no, '?') || ' / ' || new.id::text,
    jsonb_build_object(
      'order_id',      new.order_id,
      'order_no',      v_order_no,
      'order_item_id', new.id,
      'description',   new.description,
      'from',          v_from::text,
      'to',            v_to::text,
      'reason',        v_reason,
      'refund_method', new.refund_method::text
    )
  );

  return new;
end;
$fn$;
