-- Restore the reference format the repo defines.
--
-- 20260101000800 defines next_reference() with lpad(..., 6, '0'), and every
-- reference already issued follows it: ORD-2026-000001, R-2026-000001. The
-- function deployed to this database pads to 4 instead, so the next order would
-- have been ORD-2026-0002 -- the same column holding two formats that sort
-- wrongly against each other.
--
-- The drift came from the schema being created by hand rather than by these
-- migrations, which is also why the migration history was empty until it was
-- repaired. A history repair can only check that a migration's tables exist; it
-- cannot see that a function inside one was altered afterwards.
--
-- Nothing here is new. The body below is copied verbatim from 20260101000800,
-- re-asserted with create or replace so a database that drifted comes back into
-- line and one that never did is unaffected. References already issued keep
-- whatever they have; only newly generated ones change.

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
