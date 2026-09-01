-- Extends the insert-only grant lock (20260101002600) to the returns ledger.
--
-- returns and return_items are the same shape as the three tables that
-- migration covers: RLS grants SELECT and nothing else, there is no UPDATE or
-- DELETE policy on either, and every write goes through record_return(), which
-- is SECURITY DEFINER and owns the tables. So the second, coarser lock applies
-- for the same reason -- revoke the privilege itself, and a future policy
-- mistake cannot re-open an edit path the role no longer holds.
--
-- The case is arguably stronger here than for the others. A return IS the
-- correction mechanism (A-FR-8.6): the sale is frozen and getting a return
-- wrong is fixed by recording another transaction. A correction that can itself
-- be quietly rewritten corrects nothing.
--
-- Separate migration rather than an edit to 20260101002600, which is already
-- applied. INSERT is not granted to authenticated on either table to begin
-- with, so only UPDATE and DELETE are worth revoking.

revoke update, delete on public.returns      from authenticated, anon;
revoke update, delete on public.return_items from authenticated, anon;
