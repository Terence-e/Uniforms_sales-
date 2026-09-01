-- RENUMBERED from 20260101001500.
--
-- It collided with 20260101001500_audit_log_expand.sql. The CLI keys applied
-- migrations by version alone, and schema_migrations has version as its primary
-- key -- so the second file at a shared version can never be recorded, and
-- every `supabase db push` fails on it with a duplicate-key error. That blocked
-- insert_only_grants behind it.
--
-- Moved to a free version rather than merged into audit_log_expand: the two are
-- unrelated changes and each has its own down-migration. The DDL below is
-- idempotent (create or replace / set default / drop if exists), so re-running
-- it against a database that already has it applied is safe -- which is what
-- made the renumber possible without a reset.

-- Human document references, genuinely gap-free (A-FR-9.2 and the numbering rule).
--
-- Every document -- sale, order, collection, and the alteration/return slips to
-- come -- carries a reference like SAL-2026-0001: a fixed English prefix, the
-- year, and a per-(prefix, year) counter that restarts each January. The
-- prefixes are SAL, ORD, COL, ALT, RTN and never translate; the bilingual label
-- printed beside the code carries the meaning, not the code itself.
--
-- The point of the counter is the AUDIT it enables: a gap in SAL-2026-0003 ->
-- SAL-2026-0005 says a document was destroyed. For that signal to mean anything
-- the sequence must be gap-free always, not merely usually. Two things break
-- that, and this migration closes both:
--
--   1. A plain Postgres sequence (what sales used via next_receipt_no) hands out
--      a number and keeps it even if the transaction rolls back. Numbers leak on
--      every failed insert. `reference_counters` + `next_reference` already fix
--      this for orders and collections: the counter lives in a table row that is
--      updated inside the caller's transaction, so a rollback takes the
--      increment with it.
--
--   2. Drawing the number in one transaction and writing the document in
--      ANOTHER. createSale/createOrder inserted the header (burning the number,
--      committed) and the line items in a SECOND PostgREST call, deleting the
--      header by hand if the lines failed -- which leaves the number burned and
--      the row gone: a gap. The record_sale/record_order functions below put the
--      header, the lines, and therefore the reference draw in ONE transaction.
--      If anything raises, the whole thing unwinds, number included.

-- ---------------------------------------------------------------- format

-- Repoint to a 4-digit counter: PREFIX-YYYY-NNNN (was 6-digit). lpad only pads,
-- never truncates, so the 10000th document of a year widens to five digits
-- rather than colliding -- still unique, still gap-free.
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

  return p_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
end;
$fn$;

-- ---------------------------------------------------------------- sales -> SAL

-- Sales were the last document still numbered off a leaky sequence. Move them
-- onto the shared, transactional counter. Existing rows keep the R-YYYY-NNNNNN
-- numbers they were issued -- a reference, once printed, is never rewritten.
alter table public.sales
  alter column receipt_no set default public.next_reference('SAL');

-- The sequence and its wrapper are now unreferenced. Dropping them removes the
-- only remaining way to mint a gap-prone number.
drop function if exists public.next_receipt_no();
drop sequence if exists public.receipt_seq;

-- ---------------------------------------------------------------- record_sale

-- One sale, one transaction. The header insert draws SAL-YYYY-NNNN via the
-- column default; the line items go in against it; both commit together or not
-- at all. SECURITY INVOKER so the caller's RLS still governs every write exactly
-- as the two-call flow did -- a seller may only file a sale under their own id.
--
-- Totals are recomputed here from the lines, so a tampered payload cannot set
-- its own subtotal. p_items is
--   [{"product_id": uuid|null, "description": text, "size": text|null,
--     "unit_price": numeric, "quantity": int}, ...].
create or replace function public.record_sale(
  p_customer_name  text,
  p_student_name   text,
  p_class_level    text,
  p_phone          text,
  p_payment_method text,
  p_discount       numeric,
  p_notes          text,
  p_signature_url  text,
  p_items          jsonb
)
returns table (id uuid, receipt_no text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_actor    uuid := auth.uid();
  v_subtotal numeric(12, 2);
  v_discount numeric(12, 2);
  v_total    numeric(12, 2);
  v_sale_id  uuid;
  v_receipt  text;
begin
  if v_actor is null then
    raise exception 'Not signed in';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A sale needs at least one line';
  end if;

  select coalesce(sum(round((i ->> 'unit_price')::numeric * (i ->> 'quantity')::int, 2)), 0)
    into v_subtotal
    from jsonb_array_elements(p_items) as i;

  -- Clamp exactly as computeTotals() does client- and server-side.
  v_discount := least(greatest(coalesce(p_discount, 0), 0), v_subtotal);
  v_total    := v_subtotal - v_discount;

  insert into public.sales (
    customer_name, student_name, class_level, phone, payment_method,
    subtotal, discount, total, notes, signature_url, seller_id
  ) values (
    p_customer_name, p_student_name, p_class_level, p_phone,
    p_payment_method::public.payment_method,
    v_subtotal, v_discount, v_total, p_notes, p_signature_url, v_actor
  )
  returning sales.id, sales.receipt_no into v_sale_id, v_receipt;

  insert into public.sale_items (
    sale_id, product_id, description, size, unit_price, quantity, line_total
  )
  select v_sale_id,
         nullif(i ->> 'product_id', '')::uuid,
         i ->> 'description',
         nullif(i ->> 'size', ''),
         (i ->> 'unit_price')::numeric,
         (i ->> 'quantity')::int,
         round((i ->> 'unit_price')::numeric * (i ->> 'quantity')::int, 2)
  from jsonb_array_elements(p_items) as i;

  return query select v_sale_id, v_receipt;
end;
$fn$;

revoke all on function public.record_sale(text, text, text, text, text, numeric, text, text, jsonb) from public;
grant execute on function public.record_sale(text, text, text, text, text, numeric, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------- record_order

-- The same one-transaction guarantee for orders, which had the identical
-- two-call leak. Extra over a sale: an expected-ready date, the tailor's
-- measurements, and a per-line handed_over flag -- a line taken away at the
-- counter never enters the workflow, so its status is stored NULL (A-FR-9.5).
--
-- p_items is the sale shape plus "handed_over": bool.
create or replace function public.record_order(
  p_customer_name       text,
  p_student_name        text,
  p_class_level         text,
  p_phone               text,
  p_payment_method      text,
  p_discount            numeric,
  p_expected_ready_date date,
  p_measurements        text,
  p_notes               text,
  p_items               jsonb
)
returns table (id uuid, order_no text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_actor    uuid := auth.uid();
  v_subtotal numeric(12, 2);
  v_discount numeric(12, 2);
  v_total    numeric(12, 2);
  v_order_id uuid;
  v_order_no text;
begin
  if v_actor is null then
    raise exception 'Not signed in';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'An order needs at least one line';
  end if;

  select coalesce(sum(round((i ->> 'unit_price')::numeric * (i ->> 'quantity')::int, 2)), 0)
    into v_subtotal
    from jsonb_array_elements(p_items) as i;

  v_discount := least(greatest(coalesce(p_discount, 0), 0), v_subtotal);
  v_total    := v_subtotal - v_discount;

  insert into public.orders (
    customer_name, student_name, class_level, phone, payment_method,
    subtotal, discount, total, expected_ready_date, measurements, notes, seller_id
  ) values (
    p_customer_name, p_student_name, p_class_level, p_phone,
    p_payment_method::public.payment_method,
    v_subtotal, v_discount, v_total, p_expected_ready_date, p_measurements,
    p_notes, v_actor
  )
  returning orders.id, orders.order_no into v_order_id, v_order_no;

  insert into public.order_items (
    order_id, product_id, description, size, unit_price, quantity, line_total, status
  )
  select v_order_id,
         nullif(i ->> 'product_id', '')::uuid,
         i ->> 'description',
         nullif(i ->> 'size', ''),
         (i ->> 'unit_price')::numeric,
         (i ->> 'quantity')::int,
         round((i ->> 'unit_price')::numeric * (i ->> 'quantity')::int, 2),
         case when (i ->> 'handed_over')::boolean then null
              else 'ordered'::public.order_status end
  from jsonb_array_elements(p_items) as i;

  return query select v_order_id, v_order_no;
end;
$fn$;

revoke all on function public.record_order(text, text, text, text, text, numeric, date, text, text, jsonb) from public;
grant execute on function public.record_order(text, text, text, text, text, numeric, date, text, text, jsonb) to authenticated;
