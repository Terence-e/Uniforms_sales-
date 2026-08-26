'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { StockMovementKind } from '@/types/database.types';

/**
 * Phase 2. The tables, triggers and policies already exist
 * (supabase/migrations/20260101000100_stock.sql), so these read paths work
 * today; the write paths are wired but not yet reachable from the UI.
 */

export async function listStock() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select(
      `id, sku, name_en, name_fr, category, size, unit_price, is_active,
       level:stock_levels ( quantity, reorder_level )`
    )
    .eq('is_active', true)
    .order('category')
    .order('name_en');

  return (data ?? []).map((product) => {
    // stock_levels is one row per product, but PostgREST embeds it as an array
    // because the foreign key lives on the stock_levels side.
    const level = Array.isArray(product.level) ? product.level[0] : product.level;
    const quantity = level?.quantity ?? 0;
    const reorderLevel = level?.reorder_level ?? 0;
    return { ...product, quantity, reorderLevel, isLow: quantity <= reorderLevel };
  });
}

export type StockMovementResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Appends to the movement ledger. `stock_levels` is updated by the
 * `apply_stock_movement` trigger, never written directly -- that way the
 * balance can always be rebuilt from the ledger if the two ever disagree.
 *
 * `quantity` is signed: positive adds stock, negative removes it.
 */
export async function recordStockMovement(params: {
  productId: string;
  kind: StockMovementKind;
  quantity: number;
  saleId?: string | null;
  note?: string | null;
}): Promise<StockMovementResult> {
  if (!Number.isInteger(params.quantity) || params.quantity === 0) {
    return { ok: false, error: 'quantityMustBeNonZeroInteger' };
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase.from('stock_movements').insert({
    product_id: params.productId,
    kind: params.kind,
    quantity: params.quantity,
    sale_id: params.saleId ?? null,
    note: params.note ?? null,
    created_by: user.id
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/stock', 'page');
  return { ok: true };
}

/**
 * Deducts the lines of a completed sale from stock.
 *
 * Not called by `createSale` yet: until stock counts are actually being kept
 * accurate, deducting from them would produce negative balances that look like
 * real data. Wire this in once phase 2 stocktaking is live.
 */
export async function deductStockForSale(
  saleId: string,
  lines: { productId: string | null; quantity: number }[]
): Promise<StockMovementResult> {
  for (const line of lines) {
    if (!line.productId) continue;
    const result = await recordStockMovement({
      productId: line.productId,
      kind: 'sale',
      quantity: -Math.abs(line.quantity),
      saleId
    });
    if (!result.ok) return result;
  }
  return { ok: true };
}

/** Catalogue rows for the sale form's product picker. */
export async function listProducts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select('id, sku, name_en, name_fr, size, unit_price, category')
    .eq('is_active', true)
    .order('category')
    .order('name_en');
  return data ?? [];
}
