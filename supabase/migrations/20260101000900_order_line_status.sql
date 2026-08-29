-- Order status workflow (A-FR-9.4, A-FR-9.5, A-FR-9.6, A-FR-9.24).
--
-- Status moves from the order to the LINE. An order can mix lines: the parent
-- takes the blazer home today and waits on two shirts, so the blazer never
-- enters the workflow at all while the shirts do. A single status on the order
-- cannot express that.
--
--   status IS NULL      -> handed over immediately, no workflow, never changes
--   status IS NOT NULL  -> outstanding, walks the sequence below
--
-- orders.status is dropped rather than kept as a rollup. Two sources of truth
-- for the same fact drift, and the order-level status is derivable on read from
-- the outstanding lines (see deriveOrderStatus in src/lib/order-status.ts).
--
-- The sequence, and every rule about it, is enforced here rather than in the
-- form. A status ledger the UI alone protects is not protected: anything
-- holding the anon key can PATCH a row directly.
--
--   ordered -> in_production -> ready -> collected
--
-- Backwards is one step at a time and needs a reason. Cancelled is reachable
-- from any live state and needs a reason and a refund method. Collected and
-- cancelled are terminal -- walking back out of collected is a return, not a
-- status change.

-- ---------------------------------------------------------------- columns

alter table public.order_items
  -- Nullable on purpose: NULL is the "handed over immediately" case, and it is
  -- the default because a line only joins the workflow when the seller says it
  -- is outstanding.
  add column status         public.order_status,
  -- The reason behind the CURRENT status when one was required. The history of
  -- reasons lives in audit_log; this column exists so the trigger can insist a
  -- reason was actually supplied.
  add column status_reason  text,
  add column cancelled_at   timestamptz,
  add column cancelled_by   uuid references public.profiles (id),
  -- Cancellation refunds may go out by a different method than they came in by
  -- -- paid by mobile money, refunded in cash from the till (A-FR-9.24).
  add column refund_method  public.payment_method;

-- Every line that already exists was created by the order form before this
-- migration, and that form only ever created outstanding lines.
update public.order_items set status = 'ordered' where status is null;

alter table public.order_items
  add constraint order_items_cancelled_needs_reason_and_refund check (
    status is distinct from 'cancelled'
    or (
      status_reason is not null
      and length(btrim(status_reason)) > 0
      and refund_method is not null
    )
  ),
  -- A line handed over at the counter has no workflow, so it can carry none of
  -- the workflow's paperwork either.
  add constraint order_items_immediate_carries_no_workflow check (
    status is not null
    or (status_reason is null and cancelled_at is null
        and cancelled_by is null and refund_method is null)
  );

create index order_items_status_idx on public.order_items (status)
  where status is not null;

-- ---------------------------------------------------------------- order rollup

drop index if exists public.orders_status_idx;
alter table public.orders drop column status;

-- ---------------------------------------------------------------- sequence

-- Rank orders the live states so the trigger can say "exactly one step".
-- Cancelled deliberately has no rank: it is reachable from anywhere and is not
-- part of the forward/backward line.
create or replace function public.order_status_rank(s public.order_status)
returns integer
language sql
immutable
as $fn$
  select case s
    when 'ordered'       then 1
    when 'in_production' then 2
    when 'ready'         then 3
    when 'collected'     then 4
    else null
  end;
$fn$;

-- ---------------------------------------------------------------- transitions

-- security definer so the audit insert cannot be refused by RLS. An operator
-- may move a line without being granted write access to audit_log, which is
-- the point: the audit row is not optional and not the caller's to skip.
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

create trigger order_items_enforce_transition
  before update of status on public.order_items
  for each row execute function public.enforce_order_line_transition();

-- ---------------------------------------------------------------- immutability

-- Moving a status is the only edit an operator may make to a line. Without
-- this, the RLS update policy that lets a seller advance their own order would
-- equally let them rewrite the price after the parent has paid.
create or replace function public.guard_order_item_contents()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if public.is_super_admin() then
    return new;
  end if;

  if new.order_id    is distinct from old.order_id
     or new.product_id  is distinct from old.product_id
     or new.description is distinct from old.description
     or new.size        is distinct from old.size
     or new.unit_price  is distinct from old.unit_price
     or new.quantity    is distinct from old.quantity
     or new.line_total  is distinct from old.line_total
     or new.created_at  is distinct from old.created_at then
    raise exception 'An order line''s contents cannot be edited -- only its status';
  end if;

  return new;
end;
$fn$;

create trigger order_items_guard_contents
  before update on public.order_items
  for each row execute function public.guard_order_item_contents();
