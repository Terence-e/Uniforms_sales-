'use server';

import { getTranslations } from 'next-intl/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import {
  buildGenericReportWorkbook,
  buildReconciliationWorkbook,
  reconciliationReportFilename,
  reportFilename,
  workbookToUint8Array
} from '@/lib/excel-export';
import { CURRENCY, SCHOOL } from '@/lib/format';
import type { ReportKey, ReportResult, ReportRow, ReportStamp } from '@/lib/report-types';
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
  /**
   * Returns and exchanges done outside the policy window (A-FR-8.12). Flagged
   * here so the day's overrides are visible in the report the administration
   * reads every evening, not only in the dedicated returns report.
   */
  outOfPolicy: {
    returnNo: string;
    saleRef: string;
    kind: 'return' | 'exchange';
    condition: 'unworn' | 'worn';
    elapsedDays: number | null;
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

  const [salesRes, cancelRes, orderRes, outOfPolicyRes] = await Promise.all([
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
      // Cancelled sales are not takings (A-FR-6.9); they show in Cancellations.
      .is('cancelled_at', null)
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
      .lte('ordered_at', toIso),
    // Out-of-policy returns/exchanges of the day (A-FR-8.12). `within_policy`
    // is the verdict stamped at the time, so a later change to the windows does
    // not retroactively reclassify what happened.
    admin
      .from('returns')
      .select(
        `return_no, kind, condition, elapsed_days, returned_at,
         override_reason, reason,
         sale:sales!returns_sale_id_fkey ( receipt_no )`
      )
      .is('within_policy', false)
      .gte('returned_at', fromIso)
      .lte('returned_at', toIso)
      .order('returned_at', { ascending: true })
  ]);

  const sales = salesRes.data ?? [];
  const cancels = cancelRes.data ?? [];
  const orders = orderRes.data ?? [];
  const outOfPolicyRows = outOfPolicyRes.data ?? [];

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

  // --- out-of-policy overrides (A-FR-8.12) ----------------------------------
  const outOfPolicy = outOfPolicyRows.map((r) => {
    const sale = Array.isArray(r.sale) ? r.sale[0] : r.sale;
    return {
      returnNo: r.return_no,
      saleRef: (sale as { receipt_no?: string } | null)?.receipt_no ?? '—',
      kind: r.kind,
      condition: r.condition,
      elapsedDays: r.elapsed_days ?? null,
      // The override reason is the one the seller gave for going outside the
      // window; fall back to the ordinary return reason for pre-engine rows.
      reason: r.override_reason ?? r.reason,
      at: r.returned_at
    };
  });

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
    cancellations,
    outOfPolicy
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

// ==================================================================
// Report suite (A-FR-12.3). Every report is normalised to ReportResult so one
// table renderer, one Excel builder and one print view serve all of them. All
// figures come through the service-role client: reports are whole-shop and
// available to every role (A-FR-12.4), while orders/alterations are otherwise
// seller-scoped by RLS.
// ==================================================================

const dayKey = (isoTs: string) => isoTs.slice(0, 10);

/** Builds the generation stamp (date, user, filters) shared by every export. */
export async function reportStamp(from: string, to: string): Promise<ReportStamp> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  let generatedBy = user?.email ?? 'unknown';
  if (user) {
    const admin = createAdminClient();
    const { data } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    generatedBy = data?.full_name || user.email || user.id;
  }
  return {
    schoolName: SCHOOL.name,
    generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    generatedBy,
    from,
    to
  };
}

/**
 * Fetches one report as a generic table. Column labels are localised here so
 * the on-screen view, the Excel sheet and the print view all read the same.
 */
export async function getReport(
  key: ReportKey,
  from: string,
  to: string
): Promise<ReportResult> {
  const admin = createAdminClient();
  const t = await getTranslations('Reports');
  const c = (colKey: string) => t(`suite.col.${colKey}`);
  const fromIso = new Date(`${from}T00:00:00`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999`).toISOString();
  const title = t(`suite.reports.${key}`);
  const methodLabel = (m: PaymentMethod) => t(`recon.methods.${m}`);

  switch (key) {
    // ---------------------------------------------------------- sales by period
    case 'sales-by-period': {
      const { data } = await admin
        .from('sales')
        .select('sold_at, subtotal, discount, total')
        .gte('sold_at', fromIso)
        .lte('sold_at', toIso)
        .is('cancelled_at', null);

      const byDay = new Map<string, { count: number; gross: number; discount: number; net: number }>();
      for (const s of data ?? []) {
        const d = dayKey(s.sold_at);
        const cur = byDay.get(d) ?? { count: 0, gross: 0, discount: 0, net: 0 };
        cur.count += 1;
        cur.gross += num(s.subtotal);
        cur.discount += num(s.discount);
        cur.net += num(s.total);
        byDay.set(d, cur);
      }
      const rows: ReportRow[] = Array.from(byDay, ([date, v]) => ({
        date,
        transactions: v.count,
        gross: v.gross,
        discount: v.discount,
        net: v.net
      })).sort((a, b) => String(a.date).localeCompare(String(b.date)));

      const totals: ReportRow = {
        date: t('suite.total'),
        transactions: rows.reduce((s, r) => s + Number(r.transactions), 0),
        gross: rows.reduce((s, r) => s + Number(r.gross), 0),
        discount: rows.reduce((s, r) => s + Number(r.discount), 0),
        net: rows.reduce((s, r) => s + Number(r.net), 0)
      };
      return {
        key,
        title,
        columns: [
          { key: 'date', label: c('date'), type: 'date' },
          { key: 'transactions', label: c('transactions'), type: 'number' },
          { key: 'gross', label: c('gross'), type: 'money' },
          { key: 'discount', label: c('discount'), type: 'money' },
          { key: 'net', label: c('net'), type: 'money' }
        ],
        rows,
        totals
      };
    }

    // ------------------------------------------------------- sales by garment+size
    case 'sales-by-garment': {
      const { data } = await admin
        .from('sales')
        .select('items:sale_items ( description, size, quantity, line_total )')
        .gte('sold_at', fromIso)
        .lte('sold_at', toIso)
        .is('cancelled_at', null);

      const byItem = new Map<string, { garment: string; size: string; qty: number; revenue: number }>();
      for (const sale of data ?? []) {
        for (const it of sale.items ?? []) {
          const size = it.size ?? '';
          const k = `${it.description}${size}`;
          const cur = byItem.get(k) ?? { garment: it.description, size, qty: 0, revenue: 0 };
          cur.qty += num(it.quantity);
          cur.revenue += num(it.line_total);
          byItem.set(k, cur);
        }
      }
      const rows: ReportRow[] = Array.from(byItem.values())
        .map((v) => ({ garment: v.garment, size: v.size || '—', qty: v.qty, revenue: v.revenue }))
        .sort((a, b) => Number(b.revenue) - Number(a.revenue));

      return {
        key,
        title,
        columns: [
          { key: 'garment', label: c('garment'), type: 'text' },
          { key: 'size', label: c('size'), type: 'text' },
          { key: 'qty', label: c('qty'), type: 'number' },
          { key: 'revenue', label: c('revenue'), type: 'money' }
        ],
        rows,
        totals: {
          garment: t('suite.total'),
          size: '',
          qty: rows.reduce((s, r) => s + Number(r.qty), 0),
          revenue: rows.reduce((s, r) => s + Number(r.revenue), 0)
        }
      };
    }

    // ----------------------------------------------------------- production
    case 'production': {
      const { data } = await admin
        .from('stock_movements')
        .select('quantity, product:products!stock_movements_product_id_fkey ( name_en, size )')
        .eq('kind', 'production')
        .gte('occurred_on', from)
        .lte('occurred_on', to);

      const byProduct = new Map<string, { product: string; size: string; units: number }>();
      for (const m of data ?? []) {
        const p = Array.isArray(m.product) ? m.product[0] : m.product;
        const productName = (p as { name_en?: string } | null)?.name_en ?? '—';
        const size = (p as { size?: string | null } | null)?.size ?? '';
        const k = `${productName}${size}`;
        const cur = byProduct.get(k) ?? { product: productName, size, units: 0 };
        cur.units += num(m.quantity);
        byProduct.set(k, cur);
      }
      const rows: ReportRow[] = Array.from(byProduct.values())
        .map((v) => ({ product: v.product, size: v.size || '—', units: v.units }))
        .sort((a, b) => Number(b.units) - Number(a.units));

      return {
        key,
        title,
        columns: [
          { key: 'product', label: c('product'), type: 'text' },
          { key: 'size', label: c('size'), type: 'text' },
          { key: 'units', label: c('units'), type: 'number' }
        ],
        rows,
        totals: { product: t('suite.total'), size: '', units: rows.reduce((s, r) => s + Number(r.units), 0) }
      };
    }

    // -------------------------------------------- orders placed & fulfilled
    case 'orders-turnaround': {
      const { data: orders } = await admin
        .from('orders')
        .select('id, order_no, ordered_at, items:order_items ( status )')
        .gte('ordered_at', fromIso)
        .lte('ordered_at', toIso);

      const ids = (orders ?? []).map((o) => o.id);
      const { data: cols } = ids.length
        ? await admin.from('collections').select('order_id, collected_at').in('order_id', ids)
        : { data: [] as { order_id: string; collected_at: string }[] };

      const lastCollection = new Map<string, string>();
      for (const cRow of cols ?? []) {
        const prev = lastCollection.get(cRow.order_id);
        if (!prev || cRow.collected_at > prev) lastCollection.set(cRow.order_id, cRow.collected_at);
      }

      const DAY = 86_400_000;
      let fulfilledCount = 0;
      let turnaroundSum = 0;
      const rows: ReportRow[] = (orders ?? []).map((o) => {
        const items = o.items ?? [];
        const pending = items.some(
          (it) => it.status !== null && ['ordered', 'in_production', 'ready'].includes(it.status)
        );
        const fulfilled = !pending;
        const fulfilledAt = fulfilled ? lastCollection.get(o.id) ?? o.ordered_at : null;
        let turnaround: number | null = null;
        if (fulfilled && fulfilledAt) {
          turnaround = Math.max(
            0,
            Math.round((new Date(fulfilledAt).getTime() - new Date(o.ordered_at).getTime()) / DAY)
          );
          fulfilledCount += 1;
          turnaroundSum += turnaround;
        }
        return {
          order: o.order_no,
          placed: dayKey(o.ordered_at),
          status: fulfilled ? t('suite.fulfilled') : t('suite.pending'),
          fulfilled: fulfilledAt ? dayKey(fulfilledAt) : null,
          turnaround
        };
      });

      const avg = fulfilledCount ? Math.round((turnaroundSum / fulfilledCount) * 10) / 10 : null;
      return {
        key,
        title,
        columns: [
          { key: 'order', label: c('order'), type: 'text' },
          { key: 'placed', label: c('placed'), type: 'date' },
          { key: 'status', label: c('statusCol'), type: 'text' },
          { key: 'fulfilled', label: c('fulfilledOn'), type: 'date' },
          { key: 'turnaround', label: c('turnaround'), type: 'number' }
        ],
        rows,
        totals: {
          order: t('suite.ordersSummary', { placed: rows.length, fulfilled: fulfilledCount }),
          placed: '',
          status: '',
          fulfilled: t('suite.avgTurnaround'),
          turnaround: avg
        }
      };
    }

    // ------------------------------------------------- returns & exchanges
    // A-FR-12.3: every return and exchange in the period. The within-policy
    // verdict stamped on the row at the time (A-FR-8.7, A-FR-8.14) is shown as
    // its own column so the administration can see, per line, whether the sale
    // was set aside -- the same override count A-FR-8.12 asks to make visible.
    case 'returns-exchanges': {
      const { data } = await admin
        .from('returns')
        .select(
          `return_no, kind, condition, returned_at, reason,
           elapsed_days, policy_window_days, within_policy, override_reason,
           refund_amount, refund_method, collected_amount, collected_method,
           sale:sales!returns_sale_id_fkey ( receipt_no )`
        )
        .gte('returned_at', fromIso)
        .lte('returned_at', toIso)
        .order('returned_at', { ascending: true });

      const rows: ReportRow[] = (data ?? []).map((r) => {
        const sale = Array.isArray(r.sale) ? r.sale[0] : r.sale;
        // within_policy can be null on rows recorded before the policy engine
        // (see the NOT VALID constraint in 20260101003100); read that as
        // neither in-policy nor an override rather than inventing a verdict.
        const verdict =
          r.within_policy === false
            ? t('suite.override')
            : r.within_policy === true
              ? t('suite.withinPolicy')
              : '—';
        return {
          return_no: r.return_no,
          sale: (sale as { receipt_no?: string } | null)?.receipt_no ?? '—',
          kind: t(`suite.returnKind.${r.kind}`),
          condition: t(`suite.condition.${r.condition}`),
          elapsedDays: r.elapsed_days ?? null,
          verdict,
          reason: r.override_reason ?? r.reason,
          refund: num(r.refund_amount),
          refundMethod: r.refund_method ? methodLabel(r.refund_method) : '—',
          collected: num(r.collected_amount),
          collectedMethod: r.collected_method ? methodLabel(r.collected_method) : '—',
          when: r.returned_at
        };
      });

      return {
        key,
        title,
        columns: [
          { key: 'return_no', label: c('returnNo'), type: 'text' },
          { key: 'sale', label: c('saleRef'), type: 'text' },
          { key: 'kind', label: c('kind'), type: 'text' },
          { key: 'condition', label: c('condition'), type: 'text' },
          { key: 'elapsedDays', label: c('elapsedDays'), type: 'number' },
          { key: 'verdict', label: c('verdict'), type: 'text' },
          { key: 'reason', label: c('reason'), type: 'text' },
          { key: 'refund', label: c('refund'), type: 'money' },
          { key: 'refundMethod', label: c('refundMethod'), type: 'text' },
          { key: 'collected', label: c('collected'), type: 'money' },
          { key: 'collectedMethod', label: c('collectedMethod'), type: 'text' },
          { key: 'when', label: c('when'), type: 'datetime' }
        ],
        rows,
        totals: {
          return_no: t('suite.total'),
          sale: '',
          kind: '',
          condition: '',
          elapsedDays: '',
          verdict: '',
          reason: '',
          refund: rows.reduce((s, r) => s + Number(r.refund), 0),
          refundMethod: '',
          collected: rows.reduce((s, r) => s + Number(r.collected), 0),
          collectedMethod: '',
          when: ''
        }
      };
    }

    // -------------------------------------------------------- cancellations
    case 'cancellations': {
      // Two sources: an order LINE cancelled mid-workflow, and a whole SALE
      // cancelled after the fact (A-FR-6.9). Both belong in this report.
      const [lineRes, saleRes] = await Promise.all([
        admin
          .from('order_items')
          .select(
            `line_total, refund_method, status_reason, cancelled_at, description,
             order:orders!order_items_order_id_fkey ( order_no )`
          )
          .eq('status', 'cancelled')
          .gte('cancelled_at', fromIso)
          .lte('cancelled_at', toIso),
        admin
          .from('sales')
          .select('receipt_no, total, cancel_reason, cancelled_at')
          .not('cancelled_at', 'is', null)
          .gte('cancelled_at', fromIso)
          .lte('cancelled_at', toIso)
      ]);

      const lineRows: ReportRow[] = (lineRes.data ?? []).map((c2) => {
        const order = Array.isArray(c2.order) ? c2.order[0] : c2.order;
        return {
          order: (order as { order_no?: string } | null)?.order_no ?? '—',
          item: c2.description,
          reason: c2.status_reason ?? '—',
          refundMethod: c2.refund_method ? methodLabel(c2.refund_method) : '—',
          when: c2.cancelled_at,
          amount: num(c2.line_total)
        };
      });

      const saleRows: ReportRow[] = (saleRes.data ?? []).map((s) => ({
        order: s.receipt_no,
        item: t('suite.wholeSale'),
        reason: s.cancel_reason ?? '—',
        refundMethod: '—',
        when: s.cancelled_at,
        amount: num(s.total)
      }));

      const rows: ReportRow[] = [...lineRows, ...saleRows].sort((a, b) =>
        String(a.when ?? '').localeCompare(String(b.when ?? ''))
      );

      return {
        key,
        title,
        columns: [
          { key: 'order', label: c('order'), type: 'text' },
          { key: 'item', label: c('item'), type: 'text' },
          { key: 'reason', label: c('reason'), type: 'text' },
          { key: 'refundMethod', label: c('refundMethod'), type: 'text' },
          { key: 'when', label: c('when'), type: 'datetime' },
          { key: 'amount', label: c('amount'), type: 'money' }
        ],
        rows,
        totals: {
          order: t('suite.total'),
          item: '',
          reason: '',
          refundMethod: '',
          when: '',
          amount: rows.reduce((s, r) => s + Number(r.amount), 0)
        }
      };
    }

    // ---------------------------------------------------------------- audit
    case 'audit': {
      const { data } = await admin
        .from('audit_log')
        .select('created_at, actor_name, action, target_table, target_id, meta')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: false })
        .limit(5000);

      const rows: ReportRow[] = (data ?? []).map((a) => ({
        when: a.created_at,
        actor: a.actor_name ?? '—',
        action: a.action,
        target: [a.target_table, a.target_id].filter(Boolean).join(' ') || '—',
        details: a.meta ? JSON.stringify(a.meta) : ''
      }));

      return {
        key,
        title,
        columns: [
          { key: 'when', label: c('when'), type: 'datetime' },
          { key: 'actor', label: c('actor'), type: 'text' },
          { key: 'action', label: c('action'), type: 'text' },
          { key: 'target', label: c('target'), type: 'text' },
          { key: 'details', label: c('details'), type: 'text' }
        ],
        rows
      };
    }
  }
}

export type ReportExportResult =
  | { ok: true; filename: string; base64: string }
  | { ok: false; error: string };

/** Exports a suite report to Excel: stamped (A-FR-12.5) and audited (A-FR-12.6). */
export async function exportReportExcel(
  key: ReportKey,
  from: string,
  to: string
): Promise<ReportExportResult> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const [result, stamp] = await Promise.all([getReport(key, from, to), reportStamp(from, to)]);
  const workbook = buildGenericReportWorkbook(result, stamp, CURRENCY);

  await logAudit({
    actorId: user.id,
    action: 'export_generated',
    targetTable: 'audit_log',
    newValue: { report: key, format: 'xlsx', from, to }
  });

  return {
    ok: true,
    filename: reportFilename(key, from, to),
    base64: Buffer.from(workbookToUint8Array(workbook)).toString('base64')
  };
}

/**
 * Audits a PDF export (A-FR-12.6). The PDF itself is produced by the browser's
 * print-to-PDF from the stamped print view, so there is no file to build here --
 * only the audit row the acceptance requires for every export.
 */
export async function logReportPrint(
  key: ReportKey,
  from: string,
  to: string
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  await logAudit({
    actorId: user.id,
    action: 'export_generated',
    targetTable: 'audit_log',
    newValue: { report: key, format: 'pdf', from, to }
  });
  return { ok: true };
}
