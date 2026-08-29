'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { computeLineTotal, computeTotals } from '@/lib/validation/sale-schema';
import { orderSchema, type OrderInput } from '@/lib/validation/order-schema';

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNo: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Places an order and its line items (A-FR-9.1, A-FR-9.2, A-FR-9.3).
 *
 * Deliberately does NOT touch stock. The garment is still in the shop -- or not
 * made yet -- so there is nothing to deduct. The stock movement belongs to the
 * collection event, and writing one here would show goods leaving that are
 * physically still on the shelf. This is the whole point of the issue, so if you
 * are tempted to call deductStockForSale() from this function, don't.
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
      line_total: computeLineTotal(item)
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

// ------------------------------------------------------------------ queries

/** Rows for the "recent orders" list beside the entry form. */
export async function listRecentOrders(limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('id, order_no, ordered_at, customer_name, total, status, expected_ready_date')
    .order('ordered_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** A single order with its lines and seller, for the order receipt. */
export async function getOrderWithItems(orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select(
      `id, order_no, ordered_at, expected_ready_date, status, customer_name,
       student_name, class_level, phone, payment_method, subtotal, discount,
       total, measurements, notes,
       seller:profiles!orders_seller_id_fkey ( full_name ),
       items:order_items ( id, description, size, unit_price, quantity, line_total )`
    )
    .eq('id', orderId)
    .single();
  return data;
}
