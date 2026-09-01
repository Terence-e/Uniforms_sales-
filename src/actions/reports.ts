'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import {
  buildReconciliationWorkbook,
  reconciliationReportFilename,
  workbookToUint8Array
} from '@/lib/excel-export';
import { CURRENCY, SCHOOL } from '@/lib/format';
import type { PaymentMethod } from '@/types/database.types';

/**
 * Daily cash reconciliation -- the priority report (A-FR-12.1).
 *
 * The defining rule: cash and mobile money are NEVER merged into one figure.
 * Only cash belongs in the box; mobile money is checked against the phone. So
 * every total here is per-method, and the box figure (`netCashInBox`) is cash
 * receipts minus cash refunds and nothing else.
 *
 * Read through the service-role client on purpose. This is a whole-shop document
 * available to every role (A-FR-12.4), and orders are otherwise visible only to
 * their own seller (see supabase/policies/08_orders.sql) -- an RLS read would
 * quietly under-count the day for anyone but an oversight role.
 */

/** Order-line statuses that mean "paid for, not yet handed over". A NULL status
 * is a line taken at the counter (delivered); 'collected' left the shop;
 * 'cancelled' was refunded. Everything else is still owed as goods. */
const UNDELIVERED = ['ordered', 'in_production', 'ready'];

export type MethodTotal = { method: PaymentMethod; total: number; count: number };

export type DailyReconciliation = {
  from: string;
  to: string;
  transactionCount: number;
  /** Sum of line subtotals, before discounts. */
  grossSales: number;
  discountsTotal: number;
  /** What was actually taken across all methods -- the by-method totals sum to this. */
  netCollected: number;
  byMethod: MethodTotal[];
  refundsByMethod: MethodTotal[];
  /** Cash receipts minus cash refunds. Never mixed with mobile money. */
  netCashInBox: number;
  /** MoMo + Orange Money, each transaction listed for checking against the phone. */
  mobileMoney: {
    total: number;
    transactions: {
      receiptNo: string;
      method: PaymentMethod;
      reference: string | null;
      amount: number;
      receiver: string;
    }[];
  };
  /** Orders paid in the period whose goods have not been collected yet. */
  undeliveredOrdersTotal: number;
  byReceiver: { name: string; total: number; count: number }[];
  discounts: { receiptNo: string; amount: number; reason: string | null }[];
  cancellations: {
    orderNo: string;
    description: string;
    amount: number;
    refundMethod: PaymentMethod | null;
    reason: string | null;
    at: string | null;
  }[];
};

const MOBILE_METHODS: PaymentMethod[] = ['mobile_money', 'orange_money'];
const num = (v: unknown) => Number(v ?? 0);

/** One profile embed may come back as an object or a one-element array. */
function name(rel: unknown): string | null {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { full_name?: string } | null)?.full_name ?? null;
}

function tallyByMethod(rows: { method: PaymentMethod; amount: number }[]): MethodTotal[] {
  const byMethod = new Map<PaymentMethod, { total: number; count: number }>();
  for (const { method, amount } of rows) {
    const cur = byMethod.get(method) ?? { total: 0, count: 0 };
    cur.total += amount;
    cur.count += 1;
    byMethod.set(method, cur);
  }
  return Array.from(byMethod, ([method, v]) => ({ method, ...v }));
}

const methodTotal = (totals: MethodTotal[], method: PaymentMethod) =>
  totals.find((t) => t.method === method)?.total ?? 0;

export async function getDailyReconciliation(
  from: string,
  to: string
): Promise<DailyReconciliation> {
  const admin = createAdminClient();
  const fromIso = new Date(`${from}T00:00:00`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999`).toISOString();

  const [salesRes, cancelRes, orderRes] = await Promise.all([
    admin
      .from('sales')
      .select(
        `id, receipt_no, sold_at, payment_method, subtotal, discount, total,
         discount_reason, payment_reference, received_by,
         receiver:profiles!sales_received_by_fkey ( full_name ),
         seller:profiles!sales_seller_id_fkey ( full_name )`
      )
      .gte('sold_at', fromIso)
      .lte('sold_at', toIso)
      .order('sold_at', { ascending: true }),
    admin
      .from('order_items')
      .select(
        `line_total, refund_method, status_reason, cancelled_at, description,
         order:orders!order_items_order_id_fkey ( order_no )`
      )
      .eq('status', 'cancelled')
      .gte('cancelled_at', fromIso)
      .lte('cancelled_at', toIso)
      .order('cancelled_at', { ascending: true }),
    admin
      .from('orders')
      .select('id, ordered_at, items:order_items ( line_total, status )')
      .gte('ordered_at', fromIso)
      .lte('ordered_at', toIso)
  ]);

  const sales = salesRes.data ?? [];
  const cancels = cancelRes.data ?? [];
  const orders = orderRes.data ?? [];

  // --- sales-side aggregates ------------------------------------------------
  const byMethod = tallyByMethod(
    sales.map((s) => ({ method: s.payment_method, amount: num(s.total) }))
  );

  const grossSales = sales.reduce((sum, s) => sum + num(s.subtotal), 0);
  const discountsTotal = sales.reduce((sum, s) => sum + num(s.discount), 0);
  const netCollected = sales.reduce((sum, s) => sum + num(s.total), 0);

  const mobileMoneyTx = sales
    .filter((s) => MOBILE_METHODS.includes(s.payment_method))
    .map((s) => ({
      receiptNo: s.receipt_no,
      method: s.payment_method,
      reference: s.payment_reference,
      amount: num(s.total),
      // Falls back to the seller for rows recorded before receiver capture.
      receiver: name(s.receiver) ?? name(s.seller) ?? '—'
    }));

  const byReceiverMap = new Map<string, { total: number; count: number }>();
  for (const s of sales) {
    const who = name(s.receiver) ?? name(s.seller) ?? '—';
    const cur = byReceiverMap.get(who) ?? { total: 0, count: 0 };
    cur.total += num(s.total);
    cur.count += 1;
    byReceiverMap.set(who, cur);
  }

  const discounts = sales
    .filter((s) => num(s.discount) > 0)
    .map((s) => ({ receiptNo: s.receipt_no, amount: num(s.discount), reason: s.discount_reason }));

  // --- refunds / cancellations (order-line cancellations) -------------------
  const refundsByMethod = tallyByMethod(
    cancels
      .filter((c) => c.refund_method)
      .map((c) => ({ method: c.refund_method as PaymentMethod, amount: num(c.line_total) }))
  );

  const cancellations = cancels.map((c) => {
    const order = Array.isArray(c.order) ? c.order[0] : c.order;
    return {
      orderNo: (order as { order_no?: string } | null)?.order_no ?? '—',
      description: c.description,
      amount: num(c.line_total),
      refundMethod: c.refund_method,
      reason: c.status_reason,
      at: c.cancelled_at
    };
  });

  // --- money taken for undelivered orders -----------------------------------
  const undeliveredOrdersTotal = orders.reduce((sum, o) => {
    const items = o.items ?? [];
    const owed = items
      .filter((it) => it.status !== null && UNDELIVERED.includes(it.status))
      .reduce((s, it) => s + num(it.line_total), 0);
    return sum + owed;
  }, 0);

  return {
    from,
    to,
    transactionCount: sales.length,
    grossSales,
    discountsTotal,
    netCollected,
    byMethod,
    refundsByMethod,
    netCashInBox: methodTotal(byMethod, 'cash') - methodTotal(refundsByMethod, 'cash'),
    mobileMoney: {
      total: mobileMoneyTx.reduce((sum, t) => sum + t.amount, 0),
      transactions: mobileMoneyTx
    },
    undeliveredOrdersTotal,
    byReceiver: Array.from(byReceiverMap, ([name, v]) => ({ name, ...v })).sort(
      (a, b) => b.total - a.total
    ),
    discounts,
    cancellations
  };
}

export type ReconExportResult =
  | { ok: true; filename: string; base64: string }
  | { ok: false; error: string };

/**
 * Exports the daily reconciliation to Excel (A-FR-12.5): the workbook is stamped
 * with the generation date, the user who generated it and the filters applied,
 * and the export itself is audited (A-FR-12.6). Available to every role -- the
 * report is whole-shop, so the figures come through the service-role client.
 */
export async function exportReconciliationToExcel(
  from: string,
  to: string
): Promise<ReconExportResult> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const recon = await getDailyReconciliation(from, to);

  const workbook = buildReconciliationWorkbook(recon, {
    from,
    to,
    currency: CURRENCY,
    schoolName: SCHOOL.name,
    generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    generatedBy: profile?.full_name || user.email || user.id
  });

  await logAudit({
    actorId: user.id,
    action: 'export_generated',
    targetTable: 'sales',
    newValue: { report: 'reconciliation', from, to }
  });

  return {
    ok: true,
    filename: reconciliationReportFilename(from, to),
    base64: Buffer.from(workbookToUint8Array(workbook)).toString('base64')
  };
}
