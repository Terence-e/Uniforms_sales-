-- Low-stock threshold moves to the product (A-FR-4.2: "per product").
--
-- It used to live on stock_levels, which held one row per product. Now that
-- stock_levels is keyed by (product_id, size) there is no single row to hang a
-- product-wide threshold on, and creating a product (which has no sizes yet)
-- has no stock_levels row to write to at all. The threshold is a property of
-- the garment, not of any one size of it, so it belongs on products.
--
-- stock_levels.reorder_level is left in place (unused) rather than dropped, to
-- keep this change small; a later cleanup can remove it.
--
-- WARNING: unrun. Apply to a disposable database and smoke-test before go-live.

alter table public.products
  add column if not exists reorder_level integer not null default 0
    check (reorder_level >= 0);
