-- Rollback for 20260101002200_sale_attribution.sql.
--
-- MANUAL ONLY -- see supabase/README.md. Run this BEFORE
-- 20260101002100_orange_money_down.sql (which is itself a no-op).
--
-- Caveat: this destroys who received each payment, which is the record that
-- settles a short drawer. seller_id survives, but it answers a different
-- question -- who was signed in, not who counted the cash. Export sales before
-- running this anywhere real.

drop index if exists public.sales_received_by_idx;

alter table public.sales
  drop column if exists payment_reference,
  drop column if exists received_by,
  drop column if exists recorded_by;
