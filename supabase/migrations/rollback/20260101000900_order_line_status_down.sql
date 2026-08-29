-- Rollback for 20260101000900_order_line_status.sql.
--
-- MANUAL ONLY -- apply by hand (psql or the SQL editor), never with `db push`
-- or `db reset`. See supabase/README.md.
--
-- Caveat: restoring orders.status cannot recover what it held before, because
-- the up-migration dropped it and the truth now lives per line. The backfill
-- below derives an order-level status from the least advanced outstanding line,
-- which is the same rule the app used while this migration was live. Orders
-- whose lines were all handed over immediately have no line status to derive
-- from and fall back to 'ordered'.
--
-- Cancellation reasons and refund methods recorded per line are destroyed by
-- this rollback. Export public.order_items before running it anywhere real.
-- The audit_log rows survive -- they are the only record that remains.

drop trigger if exists order_items_guard_contents on public.order_items;
drop trigger if exists order_items_enforce_transition on public.order_items;

drop function if exists public.guard_order_item_contents();
drop function if exists public.enforce_order_line_transition();

alter table public.orders
  add column status public.order_status not null default 'ordered';

update public.orders o
set status = coalesce(
  (
    select oi.status
    from public.order_items oi
    where oi.order_id = o.id
      and oi.status is not null
      and oi.status <> 'cancelled'
    order by public.order_status_rank(oi.status)
    limit 1
  ),
  -- Every outstanding line cancelled, or no outstanding lines at all.
  (
    select 'cancelled'::public.order_status
    from public.order_items oi
    where oi.order_id = o.id and oi.status = 'cancelled'
    limit 1
  ),
  'ordered'::public.order_status
);

create index orders_status_idx on public.orders (status, ordered_at);

drop function if exists public.order_status_rank(public.order_status);

drop index if exists public.order_items_status_idx;

alter table public.order_items
  drop constraint if exists order_items_immediate_carries_no_workflow,
  drop constraint if exists order_items_cancelled_needs_reason_and_refund;

alter table public.order_items
  drop column if exists refund_method,
  drop column if exists cancelled_by,
  drop column if exists cancelled_at,
  drop column if exists status_reason,
  drop column if exists status;
