-- Rollback for 20260101001300_production_entry.sql.
--
-- MANUAL ONLY -- see supabase/README.md. Run
-- 20260101001400_record_production_batch_down.sql first; the function writes
-- the columns dropped here.
--
-- Caveat: dropping occurred_on, tailor_name and batch_id destroys the record of
-- when garments were made, by whom, and which rows were one submission. The
-- movements themselves survive, so stock_levels stays correct -- what is lost
-- is the provenance, not the balance.
--
-- Postgres cannot remove a value from an enum, so 'production' stays in
-- stock_movement_kind permanently, and any rows already carrying it keep it.
-- Those rows will read as a kind with no remaining meaning in the app; treat
-- them as intake if you truly need to reverse this.

drop index if exists public.stock_movements_occurred_idx;
drop index if exists public.stock_movements_batch_idx;

alter table public.stock_movements
  drop column if exists batch_id,
  drop column if exists tailor_name,
  drop column if exists occurred_on;
