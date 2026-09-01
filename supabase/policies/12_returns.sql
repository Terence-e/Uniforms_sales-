-- Returns, exchanges and their line items.
--
-- Read is universal, matching sales: the returns ledger is shared information,
-- and a shop where a seller cannot see that a garment already came back is a
-- shop that takes it back twice.
--
-- Read-only from the client. Nothing inserts here directly -- record_return()
-- is security definer and does all the writing, because one return spans four
-- tables and must not be able to half-happen. Granting insert as well would
-- offer a second route that skips the quantity checks, the derived amounts and
-- the audit row.
--
-- No update policy and no delete policy at all. A return is a correction; a
-- correction that can itself be quietly rewritten corrects nothing. Getting it
-- wrong is fixed by recording another transaction, which is the same rule the
-- sale itself now lives under (A-FR-8.6).
--
-- Idempotent -- safe to re-run after edits.

-- --------------------------------------------------------------------- returns

drop policy if exists "returns_select_all" on public.returns;
create policy "returns_select_all"
  on public.returns for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------- return_items

drop policy if exists "return_items_select_all" on public.return_items;
create policy "return_items_select_all"
  on public.return_items for select
  to authenticated
  using (true);
