-- Rollback for 20260101002000_adjustment_reason.sql.
--
-- MANUAL ONLY -- see supabase/README.md.
--
-- Dropping this constraint makes it possible again to record a stock
-- adjustment with no explanation, which is the one thing A-FR-5.5 exists to
-- prevent. Rows already written keep their reasons; only future ones lose the
-- guarantee.

alter table public.stock_movements
  drop constraint if exists stock_movements_adjustment_needs_reason;
