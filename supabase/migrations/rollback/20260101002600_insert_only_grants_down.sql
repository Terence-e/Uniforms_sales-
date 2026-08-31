-- Rollback for 20260101002600_insert_only_grants.sql.
--
-- MANUAL ONLY -- apply by hand (psql or the SQL editor), never with `db push`
-- or `db reset`. See supabase/README.md.
--
-- Restores the UPDATE/DELETE privileges the forward migration revoked. RLS is
-- unchanged and still refuses edits (no UPDATE/DELETE policy exists on these
-- tables), so re-granting the privilege does NOT actually re-open an edit path
-- for a signed-in user -- it merely returns the grant matrix to its prior state.

grant update, delete on public.audit_log              to authenticated, anon;
grant update, delete on public.stock_movements        to authenticated, anon;
grant update, delete on public.product_prices_history to authenticated, anon;
