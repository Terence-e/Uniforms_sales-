-- Sale cancellation (A-FR-6.9). A sale is never edited or deleted; cancelling is
-- the one permitted change and it is a controlled, one-way act:
--
--   * the receipt number stays and is never reused -- the row remains, so the
--     SAL sequence is untouched and the gap-free guarantee holds;
--   * stock is put back, by reversing the very movements the sale made rather
--     than recomputing -- a sale whose deduction half-failed restores exactly
--     what it took, no more;
--   * revenue totals exclude it (queries filter on cancelled_at is null), but
--     the sale stays fully visible, now marked Cancelled with its reason and who
--     cancelled it;
--   * it surfaces in the cancellations report.

alter table public.sales
  add column cancelled_at  timestamptz,
  add column cancelled_by  uuid references public.profiles (id),
  add column cancel_reason text;

-- A cancellation without a reason is not a record of anything (A-FR-6.9). NOT
-- VALID: no existing row is cancelled, so there is nothing to validate against,
-- and every future cancel goes through the RPC which enforces this anyway.
alter table public.sales
  add constraint sales_cancelled_needs_reason check (
    cancelled_at is null
    or (cancelled_by is not null
        and cancel_reason is not null
        and length(btrim(cancel_reason)) >= 3)
  ) not valid;

-- The open-till reports read "live sales only" constantly; index the flag.
create index sales_active_idx on public.sales (sold_at desc) where cancelled_at is null;

-- security definer: it writes audit_log and reverses stock the caller cannot
-- touch directly, and it is the ONLY way a sale row changes after it is filed.
-- The permission check RLS would apply is made explicitly, first.
create or replace function public.cancel_sale(p_sale_id uuid, p_reason text)
returns table (id uuid, receipt_no text)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor  uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_sale   record;
begin
  if v_actor is null then
    raise exception 'Not signed in';
  end if;

  -- Administration is read-only (A-FR-2.2): they may see every sale but cancel
  -- none. Enforced here, not just by a hidden button.
  if not public.can_operate() then
    raise exception 'Your role cannot cancel a sale';
  end if;

  if v_reason is null or length(v_reason) < 3 then
    raise exception 'Cancelling a sale requires a reason';
  end if;

  select s.id, s.receipt_no, s.cancelled_at
    into v_sale
    from public.sales s
   where s.id = p_sale_id
   for update;

  if not found then
    raise exception 'That sale does not exist';
  end if;
  if v_sale.cancelled_at is not null then
    raise exception 'That sale is already cancelled';
  end if;

  -- A sale that has already been returned/exchanged has had some stock put back
  -- by that return. Reversing the whole sale on top would restore it twice.
  -- Those goods left through the returns flow; use it, not this.
  if exists (select 1 from public.returns r where r.sale_id = p_sale_id) then
    raise exception 'This sale has a return against it; cancel is not available';
  end if;

  update public.sales
     set cancelled_at  = now(),
         cancelled_by  = v_actor,
         cancel_reason = v_reason
   where public.sales.id = p_sale_id;

  -- Put stock back by writing the mirror of what the sale took. Appended, never
  -- edited: the original deduction stays in the ledger and the reversal sits
  -- beside it, so the two net to zero and the history reads as what happened.
  insert into public.stock_movements (product_id, kind, quantity, sale_id, note, created_by)
  select sm.product_id, 'sale', -sm.quantity, p_sale_id,
         'Sale ' || v_sale.receipt_no || ' cancelled: ' || v_reason, v_actor
    from public.stock_movements sm
   where sm.sale_id = p_sale_id
     and sm.kind = 'sale';

  insert into public.audit_log (actor_id, action, entity, target_table, target_id, meta)
  values (
    v_actor,
    'sale_cancelled',
    v_sale.receipt_no,
    'sales',
    p_sale_id::text,
    jsonb_build_object('receipt_no', v_sale.receipt_no, 'reason', v_reason)
  );

  return query
  select s.id, s.receipt_no from public.sales s where s.id = p_sale_id;
end;
$fn$;

revoke all on function public.cancel_sale(uuid, text) from public;
grant execute on function public.cancel_sale(uuid, text) to authenticated;
