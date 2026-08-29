'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { computeLineTotal, computeTotals } from '@/lib/validation/sale-schema';
import {
  advanceLineSchema,
  cancelLineSchema,
  orderSchema,
  revertLineSchema,
  type AdvanceLineInput,
  type CancelLineInput,
  type OrderInput,
  type RevertLineInput
} from '@/lib/validation/order-schema';
import { deriveOrderStatus, nextStatus, previousStatus } from '@/lib/order-status';
import type { OrderStatus } from '@/types/database.types';

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNo: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Places an order and its line items (A-FR-9.1, A-FR-9.2, A-FR-9.3).
 *
 * Deliberately does NOT touch stock. The garment is still in the shop -- or not
 * made yet -- so there is nothing to deduct. The stock movement belongs to the
 * collection event, and writing one here would show goods leaving that are
 * physically still on the shelf.
 *
 * Everything else mirrors createSale(): totals are recomputed server-side from
 * the item rows, and `seller_id` comes from the session so a tampered payload
 * cannot attribute an order to someone else. `order_no` is assigned by the
 * column default (`next_reference('ORD')`) rather than here -- generating it in
 * app code would race between two tills.
 */
export async function createOrder(input: OrderInput): Promise<CreateOrderResult> {
  const parsed = orderSchema.safeParse(input);
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

  const order = parsed.data;
  const { subtotal, discount, total } = computeTotals(order.items, order.discount);

  const { data: inserted, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_name: order.customerName,
      student_name: order.studentName,
      class_level: order.classLevel,
      phone: order.phone,
      payment_method: order.paymentMethod,
      subtotal,
      discount,
      total,
      expected_ready_date: order.expectedReadyDate,
      measurements: order.measurements,
      notes: order.notes,
      seller_id: user.id
    })
    .select('id, order_no')
    .single();

  if (orderError || !inserted) {
    return { ok: false, error: orderError?.message ?? 'insertFailed' };
  }

  const { error: itemsError } = await supabase.from('order_items').insert(
    order.items.map((item) => ({
      order_id: inserted.id,
      product_id: item.productId,
      description: item.description,
      size: item.size,
      unit_price: item.unitPrice,
      quantity: item.quantity,
      line_total: computeLineTotal(item),
      // NULL is the whole point: a line the parent takes away at the counter
      // never enters the workflow (A-FR-9.5). Everything else starts at the
      // beginning of the sequence.
      status: item.handedOver ? null : ('ordered' as OrderStatus)
    }))
  );

  if (itemsError) {
    // Same hand-rolled undo as createSale: two PostgREST calls are not one
    // transaction, and an order with no lines is money taken for nothing.
    await supabase.from('orders').delete().eq('id', inserted.id);
    return { ok: false, error: itemsError.message };
  }

  revalidatePath('/orders', 'page');
  return { ok: true, orderId: inserted.id, orderNo: inserted.order_no };
}

// ------------------------------------------------------------ transitions

export type TransitionResult =
  | { ok: true; status: OrderStatus }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Reads the line's current status, or reports why it can't be read. */
async function currentStatus(lineId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('order_items')
    .select('id, order_id, status')
    .eq('id', lineId)
    .single();
  if (error || !data) return { row: null as null, error: 'notFound' as const };
  return { row: data, error: null };
}

/**
 * Moves a line one step along the sequence (A-FR-9.4). One tap, no reason.
 *
 * The target is computed rather than accepted from the client: a caller cannot
 * ask to jump straight to `collected`. The database refuses that too -- this is
 * belt and braces, and it also means the button needs no argument.
 */
export async function advanceOrderLine(input: AdvanceLineInput): Promise<TransitionResult> {
  const parsed = advanceLineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const { row, error } = await currentStatus(parsed.data.lineId);
  if (!row) return { ok: false, error };
  if (row.status === null) return { ok: false, error: 'lineHandedOver' };

  const target = nextStatus(row.status);
  if (!target) return { ok: false, error: 'noForwardStep' };

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from('order_items')
    // Clearing the reason matters: it belongs to the move that required it, and
    // leaving it behind would attach a step-back's explanation to a later,
    // unrelated status. The audit log keeps the history.
    .update({ status: target, status_reason: null })
    .eq('id', parsed.data.lineId);

  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath('/orders', 'page');
  return { ok: true, status: target };
}

/**
 * Moves a line one step BACK, which requires a reason (A-FR-9.6) -- a garment
 * marked Ready that turns out to need more work.
 */
export async function revertOrderLine(input: RevertLineInput): Promise<TransitionResult> {
  const parsed = revertLineSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] ??= issue.message;
    }
    return { ok: false, error: 'validation', fieldErrors };
  }

  const { row, error } = await currentStatus(parsed.data.lineId);
  if (!row) return { ok: false, error };
  if (row.status === null) return { ok: false, error: 'lineHandedOver' };

  const target = previousStatus(row.status);
  if (!target) return { ok: false, error: 'noBackStep' };

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from('order_items')
    .update({ status: target, status_reason: parsed.data.reason })
    .eq('id', parsed.data.lineId);

  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath('/orders', 'page');
  return { ok: true, status: target };
}

/**
 * Cancels a single line, refunding it (A-FR-9.24).
 *
 * Cancellation is per line, not per order: one shirt can be cancelled while the
 * rest of the order carries on. The refund method is recorded separately from
 * `orders.payment_method` because money often goes back out by a different
 * route than it came in -- paid by mobile money, refunded in cash from the till.
 *
 * `cancelled_at` and `cancelled_by` are stamped by the database trigger, not
 * here, so they record when the write was accepted rather than what a browser
 * claimed.
 */
export async function cancelOrderLine(input: CancelLineInput): Promise<TransitionResult> {
  const parsed = cancelLineSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] ??= issue.message;
    }
    return { ok: false, error: 'validation', fieldErrors };
  }

  const { row, error } = await currentStatus(parsed.data.lineId);
  if (!row) return { ok: false, error };
  if (row.status === null) return { ok: false, error: 'lineHandedOver' };

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from('order_items')
    .update({
      status: 'cancelled' as OrderStatus,
      status_reason: parsed.data.reason,
      refund_method: parsed.data.refundMethod
    })
    .eq('id', parsed.data.lineId);

  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath('/orders', 'page');
  return { ok: true, status: 'cancelled' };
}

// ------------------------------------------------------------------ queries

/**
 * Rows for the "recent orders" list beside the entry form.
 *
 * The status shown is derived from the lines rather than read from a column --
 * see deriveOrderStatus() for why the stored one was dropped.
 */
export async function listRecentOrders(limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select(
      `id, order_no, ordered_at, customer_name, total, expected_ready_date,
       items:order_items ( status )`
    )
    .order('ordered_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((order) => ({
    ...order,
    status: deriveOrderStatus((order.items ?? []).map((item) => item.status))
  }));
}

/** A single order with its lines and seller, for the detail and receipt pages. */
export async function getOrderWithItems(orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select(
      `id, order_no, ordered_at, expected_ready_date, customer_name,
       student_name, class_level, phone, payment_method, subtotal, discount,
       total, measurements, notes,
       seller:profiles!orders_seller_id_fkey ( full_name ),
       items:order_items ( id, description, size, unit_price, quantity,
                           line_total, status, status_reason, cancelled_at,
                           refund_method )`
    )
    .eq('id', orderId)
    .single();
  return data;
}
