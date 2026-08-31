-- Production entry (A-FR-5.2, A-FR-5.3, A-FR-5.4).
--
-- This shop makes its uniforms, so stock rises continuously as garments come
-- off the machines. That is not what 'intake' describes -- that kind means a
-- delivery arriving from a supplier, and a stock report that cannot tell the
-- two apart cannot answer "how much did we make this month".
--
-- Postgres can add an enum value but never remove one, so this is a one-way
-- door, the same as 'collection'.
alter type public.stock_movement_kind add value if not exists 'production';

-- ---------------------------------------------------------------- columns

alter table public.stock_movements
  -- When the garments were MADE, which is not when the row was typed. A run
  -- finished on Saturday is often entered on Monday, and created_at would
  -- quietly file it under Monday -- wrong in every production report.
  add column occurred_on  date,
  -- Free text, deliberately not a foreign key: the people sewing are not users
  -- of this system and maintaining a table of them would be a second staff
  -- register nobody updates. The form autocompletes from names already used,
  -- which gets consistency without the bureaucracy.
  add column tailor_name  text,
  -- Groups the rows written by one submission. The audit log records the batch
  -- as one entry, but without this the ledger itself cannot say which movements
  -- were the same act -- you would be reconstructing it out of audit JSON, and
  -- the ledger is supposed to be the thing that stands on its own.
  add column batch_id     uuid;

-- Existing rows predate the column; the day they were recorded is the best
-- available answer for the day they happened.
update public.stock_movements
   set occurred_on = created_at::date
 where occurred_on is null;

create index stock_movements_batch_idx on public.stock_movements (batch_id)
  where batch_id is not null;

create index stock_movements_occurred_idx on public.stock_movements (occurred_on desc);
