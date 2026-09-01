-- Rollback for 20260101003100_sale_cancellation.sql.
--
-- MANUAL ONLY -- apply by hand (psql or the SQL editor), never with `db push`
-- or `db reset`. See supabase/README.md.
--
-- Caveat: dropping the columns discards the reason and canceller of any sale
-- already cancelled, and the reversing stock_movements rows stay in the ledger
-- (they are real movements). Export public.sales before running this on anything
-- but a scratch database.

drop function if exists public.cancel_sale(uuid, text);

drop index if exists public.sales_active_idx;

alter table public.sales
  drop constraint if exists sales_cancelled_needs_reason;

alter table public.sales
  drop column if exists cancel_reason,
  drop column if exists cancelled_by,
  drop column if exists cancelled_at;
