'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
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

export type CreateSaleResult =
  | { ok: true; saleId: string; receiptNo: string }
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
  const { subtotal, discount, total } = computeTotals(sale.items, sale.discount);

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
      signature_url: sale.signature,
      seller_id: user.id
    })
    .select('id, receipt_no')
    .single();

  if (saleError || !inserted) {
    return { ok: false, error: saleError?.message ?? 'insertFailed' };
  }

  const { error: itemsError } = await supabase.from('sale_items').insert(
    sale.items.map((item) => ({
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
       payment_method, subtotal, discount, total, notes, signature_url,
       seller:profiles!sales_seller_id_fkey ( full_name ),
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
 * Blob. RLS still applies to the query, meaning a seller exports only their own
 * sales while an admin gets everything -- no extra check needed here.
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

  return {
    ok: true,
    filename: salesReportFilename(from, to),
    base64: Buffer.from(workbookToUint8Array(workbook)).toString('base64'),
    count: sales.length,
    total: sales.reduce((sum, sale) => sum + sale.total, 0)
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
