'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { returnSchema, type ReturnInput } from '@/lib/validation/return-schema';

/**
 * Returns and exchanges (A-FR-8.1 to A-FR-8.6).
 *
 * Thin on purpose. Every rule that matters -- the prices, the derived
 * difference, the quantity that is still returnable, the stock movements, the
 * audit row -- lives inside `record_return()`, because a return spans four
 * tables and PostgREST calls are not transactional. A refund recorded with no
 * garment back in stock is the one outcome a shop cannot reconcile later.
 *
 * This file parses, calls, and translates the answer.
 */

export type RecordReturnResult =
  | {
      ok: true;
      returnId: string;
      returnNo: string;
      /** What the parent gets back. Zero on an even swap. */
      refundAmount: number;
      /** What the parent pays when the new garment costs more. Zero otherwise. */
      collectedAmount: number;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function recordReturn(input: ReturnInput): Promise<RecordReturnResult> {
  const parsed = returnSchema.safeParse(input);
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

  const value = parsed.data;

  const { data, error } = await supabase
    .rpc('record_return', {
      p_sale_id: value.saleId,
      p_kind: value.kind,
      p_reason: value.reason,
      p_condition: value.condition,
      // Ids and quantities only. Prices are the server's to decide.
      p_in_items: value.returnedItems.map((line) => ({
        sale_item_id: line.saleItemId,
        quantity: line.quantity
      })),
      p_out_items: value.outgoingItems.map((line) => ({
        product_id: line.productId,
        quantity: line.quantity
      })),
      p_refund_method: value.refundMethod,
      p_collected_method: value.collectedMethod,
      p_received_by: value.receivedBy,
      p_notes: value.notes,
      p_signature_url: null
    })
    .single();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'insertFailed' };

  const row = data as {
    id: string;
    return_no: string;
    refund_amount: number;
    collected_amount: number;
  };

  revalidatePath('/returns', 'page');
  // The sale itself is unchanged (A-FR-8.6), but its receipt now has a return
  // against it, and the sales list shows stock that has moved.
  revalidatePath(`/sales/${value.saleId}/receipt`, 'page');
  revalidatePath('/sales', 'page');
  revalidatePath('/stock', 'page');

  return {
    ok: true,
    returnId: row.id,
    returnNo: row.return_no,
    refundAmount: Number(row.refund_amount),
    collectedAmount: Number(row.collected_amount)
  };
}

/**
 * A sale, with each line's still-returnable quantity worked out.
 *
 * The seller needs to see what is left before choosing, not be told afterwards
 * that a shirt already came back last week. The database enforces the same
 * limit independently -- this is the version with a face on it.
 */
export async function getSaleForReturn(saleId: string) {
  const supabase = await createClient();

  const { data: sale } = await supabase
    .from('sales')
    .select(
      `id, receipt_no, sold_at, customer_name, student_name, class_level, phone,
       payment_method, subtotal, discount, total,
       items:sale_items ( id, product_id, description, size, unit_price, quantity )`
    )
    .eq('id', saleId)
    .single();

  if (!sale) return null;

  const lineIds = (sale.items ?? []).map((item) => item.id);
  const alreadyReturned = new Map<string, number>();

  if (lineIds.length > 0) {
    const { data: priorLines } = await supabase
      .from('return_items')
      .select('sale_item_id, quantity')
      .eq('direction', 'in')
      .in('sale_item_id', lineIds);

    for (const line of priorLines ?? []) {
      if (!line.sale_item_id) continue;
      alreadyReturned.set(
        line.sale_item_id,
        (alreadyReturned.get(line.sale_item_id) ?? 0) + line.quantity
      );
    }
  }

  return {
    ...sale,
    items: (sale.items ?? []).map((item) => {
      const returned = alreadyReturned.get(item.id) ?? 0;
      return { ...item, returned, returnable: item.quantity - returned };
    })
  };
}

/** Every return and exchange against one sale, for the sale's own page. */
export async function listReturnsForSale(saleId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('returns')
    .select('id, return_no, kind, returned_at, reason, refund_amount, collected_amount')
    .eq('sale_id', saleId)
    .order('returned_at', { ascending: false });
  return data ?? [];
}

/** The returns ledger. */
export async function listReturns() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('returns')
    .select(
      `id, return_no, kind, returned_at, reason, condition,
       refund_amount, refund_method, collected_amount, collected_method,
       sale:sales!returns_sale_id_fkey ( id, receipt_no, customer_name ),
       seller:profiles!returns_seller_id_fkey ( full_name )`
    )
    .order('returned_at', { ascending: false })
    .limit(200);
  return data ?? [];
}

/** One return, with its lines, for the RTN receipt. */
export async function getReturnWithItems(returnId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('returns')
    .select(
      `id, return_no, kind, returned_at, reason, condition, notes,
       refund_amount, refund_method, collected_amount, collected_method,
       signature_url,
       sale:sales!returns_sale_id_fkey (
         id, receipt_no, sold_at, customer_name, student_name, class_level,
         payment_method
       ),
       seller:profiles!returns_seller_id_fkey ( full_name ),
       recordedBy:profiles!returns_recorded_by_fkey ( full_name ),
       receivedBy:profiles!returns_received_by_fkey ( full_name ),
       items:return_items ( id, direction, description, size, unit_price, quantity, line_total )`
    )
    .eq('id', returnId)
    .single();
  return data;
}
