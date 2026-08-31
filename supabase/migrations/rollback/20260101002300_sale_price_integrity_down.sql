-- Rollback for 20260101002300_sale_price_integrity.sql.
--
-- MANUAL ONLY -- see supabase/README.md.
--
-- Caveat: this reopens the hole the migration closed. With the trigger gone, a
-- direct API call can price a sale line at anything, and with the constraint
-- gone a discount can be recorded with no explanation. Both are the exact
-- behaviours A-FR-6.6 and A-FR-6.7 exist to prevent, so roll this back only to
-- replace it with something stricter.
--
-- Reasons already recorded are dropped with the column and cannot be recovered.

alter table public.sales
  drop constraint if exists sales_discount_needs_reason;

alter table public.sales
  drop column if exists discount_reason;

drop trigger if exists sale_items_enforce_price on public.sale_items;
drop function if exists public.enforce_sale_line_price();

-- Only safe while no sale line has a null product_id, which is true of every
-- row written while the constraint was in force.
alter table public.sale_items
  alter column product_id drop not null;
