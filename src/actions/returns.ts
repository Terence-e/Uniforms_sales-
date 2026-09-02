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
      /** False when the seller overrode the window (A-FR-8.11). */
      withinPolicy: boolean;
      elapsedDays: number;
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
      // Each line names exactly one source: the sale line it was bought on, or
      // the outgoing line it was received on in an earlier exchange.
      p_in_items: value.returnedItems.map((line) => ({
        sale_item_id: line.saleItemId,
        source_return_item_id: line.sourceReturnItemId,
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
      p_signature_url: null,
      p_override_reason: value.overrideReason
    })
    .single();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'insertFailed' };

  const row = data as {
    id: string;
    return_no: string;
    refund_amount: number;
    collected_amount: number;
    within_policy: boolean;
    elapsed_days: number;
  };

  revalidatePath('/returns', 'page');
  // The sale itself is unchanged (A-FR-8.6), but its receipt now has a return
  // against it, and the sales list shows stock that has moved.
  revalidatePath(`/sales/${value.saleId}/receipt`, 'page');
  revalidatePath('/sales', 'page');
  revalidatePath('/stock', 'page');
  // An override is an audited decision, so the audit screen has new rows.
  if (!row.within_policy) revalidatePath('/audit', 'page');

  return {
    ok: true,
    returnId: row.id,
    returnNo: row.return_no,
    refundAmount: Number(row.refund_amount),
    collectedAmount: Number(row.collected_amount),
    withinPolicy: row.within_policy,
    elapsedDays: Number(row.elapsed_days)
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

  // Everything already handed over against this sale in an earlier exchange
  // (A-FR-8.13). These are returnable too: a parent who swapped M for L and
  // found L wrong must be able to bring L back, judged against the ORIGINAL
  // sale date. Reading only sale_items would leave them stuck on day one.
  const { data: chainRows } = await supabase
    .from('return_items')
    .select('id, direction, sale_item_id, source_return_item_id, product_id, description, size, unit_price, quantity, returns!inner ( sale_id )')
    .eq('returns.sale_id', saleId);

  const chain = chainRows ?? [];

  // How much has come back against each source, whichever kind it is.
  const returned = new Map<string, number>();
  for (const line of chain) {
    if (line.direction !== 'in') continue;
    const key = line.sale_item_id ?? line.source_return_item_id;
    if (key) returned.set(key, (returned.get(key) ?? 0) + line.quantity);
  }

  const bought = (sale.items ?? []).map((item) => {
    const back = returned.get(item.id) ?? 0;
    return {
      key: item.id,
      saleItemId: item.id as string | null,
      sourceReturnItemId: null as string | null,
      product_id: item.product_id,
      description: item.description,
      size: item.size,
      unit_price: item.unit_price,
      quantity: item.quantity,
      returned: back,
      returnable: item.quantity - back,
      /** Distinguishes a garment bought outright from one received in a swap. */
      viaExchange: false
    };
  });

  const received = chain
    .filter((line) => line.direction === 'out')
    .map((line) => {
      const back = returned.get(line.id) ?? 0;
      return {
        key: line.id,
        saleItemId: null as string | null,
        sourceReturnItemId: line.id as string | null,
        product_id: line.product_id,
        description: line.description,
        size: line.size,
        unit_price: line.unit_price,
        quantity: line.quantity,
        returned: back,
        returnable: line.quantity - back,
        viaExchange: true
      };
    });

  return { ...sale, items: [...bought, ...received] };
}

/** Every return and exchange against one sale, for the sale's own page. */
export async function listReturnsForSale(saleId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('returns')
    .select(
      'id, return_no, kind, returned_at, reason, refund_amount, collected_amount, within_policy'
    )
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
       elapsed_days, within_policy, override_reason,
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
       elapsed_days, policy_window_days, within_policy, override_reason,
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
