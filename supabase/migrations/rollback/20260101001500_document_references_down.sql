-- Rollback for 20260101001500_document_references.sql.
--
-- MANUAL ONLY -- apply by hand (psql or the SQL editor), never with `db push`
-- or `db reset`. See supabase/README.md.
--
-- This reverses the format change and the atomic write path, restoring the
-- pre-migration state: 6-digit references, sales numbered off the sequence, and
-- no record_sale/record_order functions. It does NOT rewrite any reference
-- already issued -- rows keep whatever string they were stored with, so a mix
-- of 4- and 6-digit numbers can survive a round trip. That is intended: a
-- printed reference is never rewritten.
--
-- Caveat: the app (src/actions/sales.ts, src/actions/orders.ts) calls the RPCs
-- dropped below. Revert those files to the two-call insert flow before or
-- alongside this, or sale/order creation will fail.

-- ---------------------------------------------------------------- RPCs

drop function if exists public.record_sale(text, text, text, text, text, numeric, text, text, jsonb);
drop function if exists public.record_order(text, text, text, text, text, numeric, date, text, text, jsonb);

-- ---------------------------------------------------------------- sales <- seq

-- Recreate the sequence-backed receipt generator and point sales back at it.
-- start 1 matches the original definition in 20260101000000_init.sql; on a
-- database that already has R- receipts this would collide, hence scratch-only.
create sequence if not exists public.receipt_seq start 1;

create or replace function public.next_receipt_no()
returns text
language sql
volatile
as $fn$
  select 'R-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.receipt_seq')::text, 6, '0');
$fn$;

alter table public.sales
  alter column receipt_no set default public.next_receipt_no();

-- ---------------------------------------------------------------- format

-- Restore 6-digit padding on the shared counter (affects ORD/COL and any new SAL
-- draws that still route through next_reference).
create or replace function public.next_reference(p_prefix text)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_year integer := extract(year from now())::integer;
  v_next bigint;
begin
  insert into public.reference_counters as rc (prefix, year, last_value)
  values (p_prefix, v_year, 1)
  on conflict (prefix, year)
    do update set last_value = rc.last_value + 1
  returning rc.last_value into v_next;

  return p_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 6, '0');
end;
$fn$;

revoke all on function public.next_reference(text) from public;
grant execute on function public.next_reference(text) to authenticated;
