'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { reservedByProduct } from '@/actions/stock';
import {
  computeLineTotal,
  computeTotals,
  saleSchema,
  type SaleInput
} from '@/lib/validation/sale-schema';
import {
  buildSalesWorkbook,
  salesReportFilename,
  workbookToUint8Array,
  type ExportSale
} from '@/lib/excel-export';
import { CURRENCY, SCHOOL } from '@/lib/format';

/** One line asking for more than the shelf is believed to hold. */
export type Shortfall = {
  description: string;
  requested: number;
  available: number;
};

export type CreateSaleResult =
  | { ok: true; saleId: string; receiptNo: string }
  /**
   * Not an error so much as a question. The sale is refused only until the
   * seller answers it -- resubmitting with belowStockAck completes the same
   * sale and records the override.
   */
  | { ok: false; error: 'belowStock'; shortfalls: Shortfall[] }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Records a sale and its line items.
 *
 * Totals are recomputed here from the item rows -- the numbers the browser
 * displayed are never trusted. `seller_id` comes from the session, so a client
 * cannot attribute a sale to someone else even if it tampers with the payload.
 */
export async function createSale(input: SaleInput): Promise<CreateSaleResult> {
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');
      fieldErrors[path] ??= issue.message;
    }
    return { ok: false, error: 'validation', fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const sale = parsed.data;

  /*
   * Prices are read from the catalogue and the submitted ones are discarded
   * (A-FR-6.6).
   *
   * Validating what the browser sent and rejecting a mismatch would fail an
   * honest seller for a race they did not cause -- someone edits a price while
   * the form is open, and the sale bounces. Re-reading instead means the sale
   * always goes through at the price the catalogue holds right now, and the
   * database trigger exists purely to stop a direct API call, not to police
   * this function.
   */
  const productIds = sale.items.map((item) => item.productId);
  const { data: catalogue } = await supabase
    .from('products')
    .select('id, unit_price, is_active')
    .in('id', productIds);

  const priceOf = new Map((catalogue ?? []).map((p) => [p.id, p]));

  for (const item of sale.items) {
    const product = priceOf.get(item.productId);
    if (!product) return { ok: false, error: 'unknownProduct' };
    // An archived product cannot be sold: it was withdrawn for a reason, and
    // its price may be stale.
    if (!product.is_active) return { ok: false, error: 'productInactive' };
  }

  // Rebuilt from catalogue prices, never from the payload.
  const pricedItems = sale.items.map((item) => ({
    ...item,
    unitPrice: priceOf.get(item.productId)!.unit_price
  }));

  /*
   * Availability is recomputed here, never taken from the payload (A-FR-5.6).
   *
   * The browser's figure was right when the page loaded, but somebody may have
   * moved an order to Ready since. Trusting it would mean a stale number
   * silently skips both the warning and the audit row -- and a missing audit
   * row is the failure nobody ever notices.
   */
  const [{ data: levels }, reserved] = await Promise.all([
    supabase.from('stock_levels').select('product_id, quantity').in('product_id', productIds),
    reservedByProduct()
  ]);

  const inStock = new Map((levels ?? []).map((l) => [l.product_id, l.quantity]));

  // Summed per product first: three lines of the same shirt draw on one shelf,
  // and checking each line alone would pass all three against the same stock.
  const wantedPerProduct = new Map<string, number>();
  for (const item of sale.items) {
    wantedPerProduct.set(
      item.productId,
      (wantedPerProduct.get(item.productId) ?? 0) + item.quantity
    );
  }

  const shortfalls: Shortfall[] = [];
  for (const [productId, wanted] of wantedPerProduct) {
    const available = (inStock.get(productId) ?? 0) - (reserved[productId] ?? 0);
    if (wanted > available) {
      const line = sale.items.find((item) => item.productId === productId);
      shortfalls.push({
        description: line?.description ?? productId,
        requested: wanted,
        available
      });
    }
  }

  // Warns, never blocks: the seller is standing in front of the shelf, and if a
  // garment was finished but not yet entered the shelf is right and the system
  // is wrong. Refusing outright would push the shop back to paper.
  if (shortfalls.length > 0 && !sale.belowStockAck) {
    return { ok: false, error: 'belowStock', shortfalls };
  }

  const { subtotal, discount, total } = computeTotals(pricedItems, sale.discount);

  const { data: inserted, error: saleError } = await supabase
    .from('sales')
    .insert({
      customer_name: sale.customerName,
      student_name: sale.studentName,
      class_level: sale.classLevel,
      phone: sale.phone,
      payment_method: sale.paymentMethod,
      subtotal,
      discount,
      total,
      notes: sale.notes,
      discount_reason: sale.discount > 0 ? sale.discountReason : null,
      signature_url: sale.signature,
      payment_reference: sale.paymentReference,
      // Attribution: who keyed it, who took the money. Defaulted to the
      // session user when the form leaves them alone.
      recorded_by: sale.recordedBy ?? user.id,
      received_by: sale.receivedBy ?? user.id,
      // Unchanged and unchangeable: the account that actually submitted this
      // row, and the value the RLS insert policy checks against auth.uid().
      // The two attribution columns above sit alongside it rather than
      // replacing it, so a tampered payload still cannot file a sale under
      // somebody else's name.
      seller_id: user.id
    })
    .select('id, receipt_no')
    .single();

  if (saleError || !inserted) {
    return { ok: false, error: saleError?.message ?? 'insertFailed' };
  }

  const { error: itemsError } = await supabase.from('sale_items').insert(
    pricedItems.map((item) => ({
      sale_id: inserted.id,
      product_id: item.productId,
      description: item.description,
      size: item.size,
      unit_price: item.unitPrice,
      quantity: item.quantity,
      line_total: computeLineTotal(item)
    }))
  );

  if (itemsError) {
    // Postgres has no transaction across two PostgREST calls, so undo by hand.
    // A sale with no lines would silently corrupt every report.
    await supabase.from('sales').delete().eq('id', inserted.id);
    return { ok: false, error: itemsError.message };
  }

  // Audited (A-FR-11.1). Records the receipt, totals and line count -- enough to
  // reconstruct what was sold without duplicating the whole basket.
  await logAudit({
    actorId: user.id,
    action: 'sale_created',
    targetTable: 'sales',
    targetId: inserted.id,
    newValue: {
      receipt_no: inserted.receipt_no,
      customer_name: sale.customerName,
      subtotal,
      discount,
      total,
      payment_method: sale.paymentMethod,
      item_count: sale.items.length
    }
  });

  /*
   * One row per sale, not per line: a three-line sale with two shortfalls is
   * one decision the seller made once.
   *
   * Recorded as "sold beyond available", which is what actually happened.
   * Sales do not deduct stock yet, so no balance went negative -- calling it a
   * negative-stock event would state something untrue of the ledger today.
   */
  if (shortfalls.length > 0) {
    const { data: overrider } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    await logAudit({
      actorId: user.id,
      actorName: overrider?.full_name ?? user.email ?? null,
      action: 'sale_below_stock_override',
      entity: inserted.receipt_no,
      targetTable: 'sales',
      targetId: inserted.id,
      meta: { receipt_no: inserted.receipt_no, shortfalls }
    });
  }

  // A discount is a reduction someone authorised, so it is recorded as such
  // (A-FR-6.7). No audit row when there is no discount -- every sale would
  // otherwise log an event that says nothing.
  if (discount > 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    await logAudit({
      actorId: user.id,
      actorName: profile?.full_name ?? user.email ?? null,
      action: 'sale_discounted',
      entity: inserted.receipt_no,
      targetTable: 'sales',
      targetId: inserted.id,
      meta: {
        receipt_no: inserted.receipt_no,
        subtotal,
        discount,
        total,
        reason: sale.discountReason
      }
    });
  }

  revalidatePath('/sales', 'page');
  return { ok: true, saleId: inserted.id, receiptNo: inserted.receipt_no };
}

// ------------------------------------------------------------------ queries

/** Rows for the "recent sales" list beside the entry form. */
export async function listRecentSales(limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('sales')
    .select('id, receipt_no, sold_at, customer_name, total, payment_method')
    .order('sold_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** A single sale with its lines and seller, for the receipt page. */
export async function getSaleWithItems(saleId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('sales')
    .select(
      `id, receipt_no, sold_at, customer_name, student_name, class_level, phone,
       payment_method, payment_reference, subtotal, discount, total, notes,
       signature_url,
       seller:profiles!sales_seller_id_fkey ( full_name ),
       recordedBy:profiles!sales_recorded_by_fkey ( full_name ),
       receivedBy:profiles!sales_received_by_fkey ( full_name ),
       items:sale_items ( id, description, size, unit_price, quantity, line_total )`
    )
    .eq('id', saleId)
    .single();
  return data;
}

// ------------------------------------------------------------------ export

export type ExportResult =
  | { ok: true; filename: string; base64: string; count: number; total: number }
  | { ok: false; error: string };

/**
 * Builds the Excel workbook on the server and hands it back base64-encoded.
 *
 * Server Actions can't stream a file download, so the client turns this into a
 * Blob. Sales are shared, so every role exports the same full set for the range.
 */
export async function exportSalesToExcel(
  from: string,
  to: string
): Promise<ExportResult> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  // `to` is a date; include the whole day.
  const fromIso = new Date(`${from}T00:00:00`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999`).toISOString();

  const { data, error } = await supabase
    .from('sales')
    .select(
      `receipt_no, sold_at, customer_name, student_name, class_level, phone,
       payment_method, subtotal, discount, total, notes,
       seller:profiles!sales_seller_id_fkey ( full_name ),
       items:sale_items ( description, size, unit_price, quantity, line_total )`
    )
    .gte('sold_at', fromIso)
    .lte('sold_at', toIso)
    .order('sold_at', { ascending: true });

  if (error) return { ok: false, error: error.message };

  const sales: ExportSale[] = (data ?? []).map((row) => ({
    receipt_no: row.receipt_no,
    sold_at: row.sold_at,
    customer_name: row.customer_name,
    student_name: row.student_name,
    class_level: row.class_level,
    phone: row.phone,
    payment_method: row.payment_method,
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.total,
    notes: row.notes,
    seller_name: row.seller?.full_name ?? '',
    items: row.items ?? []
  }));

  const workbook = buildSalesWorkbook(sales, {
    from,
    to,
    currency: CURRENCY,
    schoolName: SCHOOL.name
  });

  const total = sales.reduce((sum, sale) => sum + sale.total, 0);

  // Generating an export is audited (A-FR-11.1, B-FR-11.4).
  await logAudit({
    actorId: user.id,
    action: 'export_generated',
    targetTable: 'sales',
    newValue: { report: 'sales', from, to, count: sales.length, total }
  });

  return {
    ok: true,
    filename: salesReportFilename(from, to),
    base64: Buffer.from(workbookToUint8Array(workbook)).toString('base64'),
    count: sales.length,
    total
  };
}

/** Headline figures for the reports page, before anyone exports anything. */
export async function getSalesSummary(from: string, to: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('sales')
    .select('total')
    .gte('sold_at', new Date(`${from}T00:00:00`).toISOString())
    .lte('sold_at', new Date(`${to}T23:59:59.999`).toISOString());

  const rows = data ?? [];
  return {
    count: rows.length,
    total: rows.reduce((sum, row) => sum + row.total, 0)
  };
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Sales totals per calendar month over the last `months` months (oldest first),
 * with empty months filled in as zero. Sales are shared, so every role sees the
 * whole team's totals.
 */
export async function getMonthlySales(months = 8) {
  const supabase = await createClient();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const { data } = await supabase
    .from('sales')
    .select('sold_at, total')
    .gte('sold_at', start.toISOString());

  const buckets = new Map<string, { total: number; count: number }>();
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    buckets.set(monthKey(d), { total: 0, count: 0 });
  }
  for (const row of data ?? []) {
    const bucket = buckets.get(monthKey(new Date(row.sold_at)));
    if (bucket) {
      bucket.total += row.total;
      bucket.count += 1;
    }
  }

  return Array.from(buckets, ([key, v]) => ({ key, total: v.total, count: v.count }));
}
