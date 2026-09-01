-- Grant-level insert-only enforcement on the append-only ledgers (spec A-11,
-- and the P0 "insert-only at the database level" rule).
--
-- These three tables are already append-only through RLS -- none of them has an
-- UPDATE or DELETE policy, so PostgREST already refuses an edit from a signed-in
-- user (04_stock.sql, 06_audit_log.sql, 07_product_prices.sql). This migration
-- adds the second, coarser lock the acceptance criterion asks for: revoke the
-- privilege itself, so a direct UPDATE/DELETE is refused by the grant system
-- before RLS is even consulted. Defense in depth -- a future policy mistake
-- cannot re-open an edit path that the role no longer holds the privilege for.
--
-- Scope is deliberately just the ledgers that are ALREADY append-only:
--   * audit_log             -- the tamper-evidence record itself
--   * stock_movements       -- corrections are compensating 'adjustment' rows
--   * product_prices_history -- price history, never rewritten
--
-- NOT applied to sales, orders, order_items or alterations: those rely on
-- in-place UPDATE by design -- super_admin sale amendment (03_sales.sql) and the
-- order/alteration status workflows -- so a blanket revoke there would break
-- shipped, intended behaviour. Making them append-only would be a schema
-- re-architecture, not a grant tweak, and is out of scope here.
--
-- INSERT and SELECT are untouched: the app still records and reads these tables.
-- Writes that must always succeed (audit_log via logAudit, batch stock movements)
-- go through the service role or SECURITY DEFINER functions, which own the tables
-- and are unaffected by revokes on the authenticated/anon roles.

revoke update, delete on public.audit_log              from authenticated, anon;
revoke update, delete on public.stock_movements        from authenticated, anon;
revoke update, delete on public.product_prices_history from authenticated, anon;
