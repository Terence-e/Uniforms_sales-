-- Recording a production batch, atomically (A-FR-5.3).
--
-- "5 shirts size 8 and 3 shirts size 10 entered together, not as two trips" is
-- several stock_movements rows. Written one PostgREST call at a time that is
-- several transactions: a failure on the third line leaves stock up by the
-- first two and no audit row explaining any of it. Here the batch either lands
-- whole or not at all.
--
-- security definer because it writes audit_log, which operators cannot write
-- directly -- the audit row is not the caller's to skip. The permission checks
-- RLS would have applied are therefore made explicitly, first.
--
-- Separate migration from 20260101001300 because that one adds the 'production'
-- enum value, and Postgres will not let a value added in a transaction be used
-- by that same transaction.
--
-- p_lines is [{"product_id": uuid, "quantity": int}, ...].

create or replace function public.record_production_batch(
  p_lines       jsonb,
  p_occurred_on date,
  p_tailor_name text,
  p_note        text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor    uuid := auth.uid();
  v_batch    uuid := gen_random_uuid();
  v_date     date := coalesce(p_occurred_on, current_date);
  v_tailor   text := nullif(btrim(coalesce(p_tailor_name, '')), '');
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_count    integer;
  v_total    integer;
  v_line     record;
begin
  if v_actor is null then
    raise exception 'Not signed in';
  end if;

  -- Administration is read-only (A-FR-2.2).
  if not public.can_operate() then
    raise exception 'Your role cannot record production';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one line';
  end if;

  -- A future date would mean garments made tomorrow. Almost always a typo in
  -- the year, and it silently corrupts every production report that follows.
  if v_date > current_date then
    raise exception 'Production cannot be dated in the future';
  end if;

  -- Validate every line BEFORE writing any of them, so a bad third line does
  -- not depend on the transaction unwinding to keep the first two out.
  for v_line in
    select (item ->> 'product_id')::uuid as product_id,
           (item ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_lines) as item
  loop
    if v_line.product_id is null then
      raise exception 'Every line needs a product';
    end if;
    -- Production only ever adds. Correcting an over-count is an 'adjustment'
    -- movement, not a negative production row -- the ledger should read as what
    -- happened, not as arithmetic.
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Quantity must be a whole number greater than zero';
    end if;

    perform 1 from public.products p
     where p.id = v_line.product_id and p.is_active;
    if not found then
      raise exception 'Unknown or inactive product on one of the lines';
    end if;
  end loop;

  insert into public.stock_movements
    (product_id, kind, quantity, occurred_on, tailor_name, note, batch_id, created_by)
  select (item ->> 'product_id')::uuid,
         'production',
         (item ->> 'quantity')::integer,
         v_date,
         v_tailor,
         v_note,
         v_batch,
         v_actor
  from jsonb_array_elements(p_lines) as item;

  -- stock_levels is NOT touched here. The apply_stock_movement trigger derives
  -- it from the rows above, which is why the balance can always be rebuilt from
  -- the ledger and why no screen ever edits a quantity directly (A-FR-5.4).

  select count(*), coalesce(sum((item ->> 'quantity')::integer), 0)
    into v_count, v_total
    from jsonb_array_elements(p_lines) as item;

  -- One audit row for the batch, not one per line: the batch is the act.
  insert into public.audit_log (actor_id, action, entity, meta)
  values (
    v_actor,
    'production_recorded',
    v_batch::text,
    jsonb_build_object(
      'batch_id',    v_batch,
      'occurred_on', v_date,
      'tailor_name', v_tailor,
      'note',        v_note,
      'line_count',  v_count,
      'total_units', v_total,
      'lines',       p_lines
    )
  );

  return v_batch;
end;
$fn$;

revoke all on function public.record_production_batch(jsonb, date, text, text) from public;
grant execute on function public.record_production_batch(jsonb, date, text, text) to authenticated;
