-- Alterations.
--
-- Mirrors the orders policies (08_orders.sql): whoever took the garment in sees
-- and manages their own, oversight roles see everything, only operators may
-- take one in or move it along, and nothing is deletable. An alteration record
-- is the school's only proof of what it agreed to do with someone else's
-- property, so it is as much a ledger row as a sale is.
--
-- The UPDATE policy grants the whole row, which RLS cannot narrow to specific
-- columns. guard_alteration_terms() is what stops a seller rewriting the charge
-- or the agreed work, and enforce_alteration_transition() is what stops an
-- illegal jump. Together they make this policy safe.
--
-- Idempotent -- safe to re-run after edits.

drop policy if exists "alterations_select_own" on public.alterations;
create policy "alterations_select_own"
  on public.alterations for select
  to authenticated
  using (received_by = (select auth.uid()));

drop policy if exists "alterations_select_admin" on public.alterations;
create policy "alterations_select_admin"
  on public.alterations for select
  to authenticated
  using (public.can_oversee());

drop policy if exists "alterations_insert_own" on public.alterations;
create policy "alterations_insert_own"
  on public.alterations for insert
  to authenticated
  with check (received_by = (select auth.uid()) and public.can_operate());

drop policy if exists "alterations_update_own" on public.alterations;
create policy "alterations_update_own"
  on public.alterations for update
  to authenticated
  using (
    public.can_operate()
    and (received_by = (select auth.uid()) or public.can_oversee())
  )
  with check (
    public.can_operate()
    and (received_by = (select auth.uid()) or public.can_oversee())
  );
