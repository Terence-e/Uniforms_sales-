'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import {
  adjustmentSchema,
  productionBatchSchema,
  type AdjustmentInput,
  type ProductionBatchInput
} from '@/lib/validation/production-schema';
import type { StockMovementKind } from '@/types/database.types';

/**
 * Stock: reads, the movement ledger, and production entry.
 *
 * `stock_levels` is never written from here. Every balance is derived by the
 * apply_stock_movement trigger from the rows in `stock_movements`, so the
 * ledger can always rebuild the balance if the two ever disagree -- and no
 * screen can edit a quantity directly (A-FR-5.4).
 *
 * `deductStockForSale()` is called by `createSale`: sales move
 * stock. Collection does (see collect_order_lines), and production does.
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

  const reserved = await reservedByProduct();

  return (data ?? []).map((product) => {
    // stock_levels is one row per product, but PostgREST embeds it as an array
    // because the foreign key lives on the stock_levels side.
    const level = Array.isArray(product.level) ? product.level[0] : product.level;
    const quantity = level?.quantity ?? 0;
    const reorderLevel = level?.reorder_level ?? 0;
    const reservedQty = reserved[product.id] ?? 0;
    return {
      ...product,
      quantity,
      reorderLevel,
      // Derived, never stored: a second copy of this number would drift the
      // moment an order moved to Ready without the copy being updated.
      reserved: reservedQty,
      // May go negative, and is shown that way. Hiding it would conceal the
      // oversell it exists to reveal (A-FR-9.10).
      available: quantity - reservedQty,
      isLow: quantity <= reorderLevel
    };
  });
}

/**
 * How many of each product are spoken for (A-FR-9.9).
 *
 * Reserved means order lines that have reached 'ready' -- and only those. A
 * garment still 'ordered' or 'in_production' does not physically exist yet, so
 * it cannot be reserved out of stock you are holding. Once it is Ready it does
 * exist, sitting on the shelf with someone's name on it, and that is precisely
 * the shirt that must not be sold to a walk-in customer.
 *
 * That makes this the exact complement of listWaitingOrderCounts(), which
 * covers 'ordered' and 'in_production': together they account for every open
 * line, with no overlap and no gap.
 *
 * Sums line QUANTITIES, not line counts -- two Ready lines of three shirts
 * reserve six. Lines with no product_id are free text and cannot be attributed,
 * so this is a floor rather than a total.
 */
export async function reservedByProduct(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('order_items')
    .select('product_id, quantity')
    .eq('status', 'ready')
    .not('product_id', 'is', null);

  const reserved: Record<string, number> = {};
  for (const line of data ?? []) {
    if (!line.product_id) continue;
    reserved[line.product_id] = (reserved[line.product_id] ?? 0) + line.quantity;
  }
  return reserved;
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

  // Every stock movement is audited (A-FR-11.1: production entry / stock
  // adjustment / return / negative-stock override all flow through here).
  await logAudit({
    actorId: user.id,
    action: 'stock_movement',
    targetTable: 'stock_movements',
    targetId: params.productId,
    newValue: {
      kind: params.kind,
      quantity: params.quantity,
      sale_id: params.saleId ?? null,
      note: params.note ?? null
    }
  });

  revalidatePath('/stock', 'page');
  return { ok: true };
}

/**
 * Deducts the lines of a completed sale from stock.
 *
 * Called by `createSale`. It was left uncalled while nothing put stock back,
 * on the grounds that deducting from counts nobody maintained would produce
 * negative balances that looked like real data. Returns changed that: they
 * credit stock, so a sale that never debits it makes every return a net gain
 * and the balance drifts up with each one (A-FR-8.2).
 *
 * Below-stock sales are permitted with a warning and an override, so a negative
 * balance here is a real state the shop can be in, not a bug.
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
/**
 * Products for the sale and production selectors, carrying what is actually
 * available to sell (A-FR-9.10).
 *
 * The sale screen works from Available rather than In stock, because a Ready
 * order line is a garment already promised to a named parent. Selling it to
 * whoever is at the counter is the double-sale this whole feature exists to
 * prevent.
 *
 * Shown, not enforced: below-stock sales are permitted with a warning, an
 * override and an audit row, which is its own issue. Blocking here would have
 * to be undone there.
 */
export async function listProducts() {
  const supabase = await createClient();
  const [{ data }, reserved] = await Promise.all([
    supabase
      .from('products')
      .select('id, sku, name_en, name_fr, size, unit_price, category, level:stock_levels ( quantity )')
      .eq('is_active', true)
      .order('category')
      .order('name_en'),
    reservedByProduct()
  ]);

  return (data ?? []).map((product) => {
    const level = Array.isArray(product.level) ? product.level[0] : product.level;
    const quantity = level?.quantity ?? 0;
    const reservedQty = reserved[product.id] ?? 0;
    return {
      ...product,
      inStock: quantity,
      reserved: reservedQty,
      available: quantity - reservedQty
    };
  });
}

// ------------------------------------------------------------- production

export type ProductionResult =
  | { ok: true; batchId: string; lineCount: number; totalUnits: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Records a batch of finished garments (A-FR-5.2, A-FR-5.3, A-FR-5.4).
 *
 * The whole batch goes through `record_production_batch()` rather than a loop of
 * inserts here. Several lines written one call at a time are several
 * transactions, and a failure on the third leaves stock up by the first two
 * with no audit row explaining it. The function also writes the single audit
 * entry for the batch, which an operator cannot write directly.
 *
 * `stock_levels` is never touched -- not here, not there. The
 * apply_stock_movement trigger derives it from the ledger, which is what makes
 * "stock quantity is derived, never a manually edited number" true rather than
 * merely intended (A-FR-5.4).
 */
export async function recordProductionBatch(
  input: ProductionBatchInput
): Promise<ProductionResult> {
  const parsed = productionBatchSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] ??= issue.message;
    }
    return { ok: false, error: 'validation', fieldErrors };
  }

  const batch = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('record_production_batch', {
    p_lines: batch.lines.map((line) => ({
      product_id: line.productId,
      quantity: line.quantity
    })),
    p_occurred_on: batch.occurredOn,
    p_tailor_name: batch.tailorName,
    p_note: batch.note
  });

  if (error || !data) return { ok: false, error: error?.message ?? 'productionFailed' };

  revalidatePath('/stock', 'page');
  return {
    ok: true,
    batchId: data,
    lineCount: batch.lines.length,
    totalUnits: batch.lines.reduce((sum, line) => sum + line.quantity, 0)
  };
}

/**
 * Names already used on production entries, for the tailor autocomplete.
 *
 * Deliberately derived from the ledger rather than kept in a table of tailors:
 * a separate register would be a second thing to maintain and would drift the
 * moment somebody typed a name that was not in it.
 */
export async function listTailorNames(limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('stock_movements')
    .select('tailor_name')
    .eq('kind', 'production')
    .not('tailor_name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  const seen = new Set<string>();
  for (const row of data ?? []) {
    if (row.tailor_name) seen.add(row.tailor_name);
    if (seen.size >= limit) break;
  }
  return [...seen];
}

/** Recent production batches, newest first, for the list under the form. */
export async function listRecentProduction(limit = 20) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('stock_movements')
    .select(
      `id, quantity, occurred_on, tailor_name, note, batch_id, created_at,
       product:products ( name_en, name_fr, size )`
    )
    .eq('kind', 'production')
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ------------------------------------------------------------- adjustments

export type AdjustmentResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Corrects a stock level, with a mandatory reason (A-FR-5.5).
 *
 * The correction is a MOVEMENT, never a write to stock_levels. That is the
 * whole discipline of this table: the balance is derived by the
 * apply_stock_movement trigger, so a count that disagrees is recorded as the
 * difference rather than by overwriting the number. The old value stays
 * visible in the ledger, which is what makes an adjustment auditable at all --
 * overwriting would erase the very discrepancy being reported.
 *
 * A single insert, so there is no batch to make atomic and no database function
 * needed. The audit row is written here rather than by a trigger, because a
 * trigger on stock_movements would also fire for production and collection
 * movements, which already record themselves elsewhere and would then be
 * logged twice.
 */
export async function recordStockAdjustment(
  input: AdjustmentInput
): Promise<AdjustmentResult> {
  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] ??= issue.message;
    }
    return { ok: false, error: 'validation', fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { productId, quantity, reason } = parsed.data;

  const { data: product } = await supabase
    .from('products')
    .select('name_en, size')
    .eq('id', productId)
    .single();

  const { error } = await supabase.from('stock_movements').insert({
    product_id: productId,
    kind: 'adjustment',
    quantity,
    note: reason,
    occurred_on: new Date().toISOString().slice(0, 10),
    created_by: user.id
  });

  if (error) return { ok: false, error: error.message };

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  await logAudit({
    actorId: user.id,
    actorName: profile?.full_name ?? user.email ?? null,
    action: 'stock_adjusted',
    entity: product ? `${product.name_en}${product.size ? ` (${product.size})` : ''}` : productId,
    targetTable: 'stock_movements',
    targetId: productId,
    // The reason is the point of the record, so it goes in the audit row too
    // rather than only in the movement it describes.
    meta: { product_id: productId, quantity, reason }
  });

  revalidatePath('/stock', 'page');
  return { ok: true };
}
