import * as XLSX from 'xlsx';
import type { PaymentMethod } from '@/types/database.types';
import type { DailyReconciliation, MethodTotal } from '@/actions/reports';
import type { ReportKey, ReportResult, ReportStamp } from '@/lib/report-types';

/**
 * Workbook building only -- no DOM, no `fs`. The Server Action turns the
 * workbook into bytes; the browser turns those bytes into a download. Keeping
 * this file isomorphic is what lets both sides agree on the layout.
 */

export type ExportItem = {
  description: string;
  size: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type ExportSale = {
  receipt_no: string;
  sold_at: string;
  customer_name: string;
  student_name: string | null;
  class_level: string | null;
  phone: string | null;
  payment_method: PaymentMethod;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  seller_name: string;
  items: ExportItem[];
};

export type ExportOptions = {
  from: string;
  to: string;
  currency: string;
  schoolName: string;
};

/**
 * MoMo and Orange Money are named separately because they are separate
 * providers with separate float and separate statements -- an export that
 * calls both "mobile money" cannot be reconciled against either.
 *
 * 'bank_transfer' is unused but still in the database type, which cannot drop
 * values, so it needs a label for exhaustiveness rather than because anything
 * will print it.
 */
const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  mobile_money: 'MoMo',
  orange_money: 'Orange Money',
  bank_transfer: 'Bank transfer'
};

/** Column widths in characters -- SheetJS has no autofit. */
function widths(...chars: number[]) {
  return chars.map((wch) => ({ wch }));
}

function moneyFormat(currency: string) {
  // Codes rather than symbols: XAF/GHS/NGN don't all have a glyph Excel knows.
  return `#,##0.00 "${currency}"`;
}

function applyNumberFormat(
  sheet: XLSX.WorkSheet,
  columns: string[],
  rowCount: number,
  format: string
) {
  for (const col of columns) {
    // Row 1 is the header, so data starts at row 2.
    for (let row = 2; row <= rowCount + 1; row++) {
      const cell = sheet[`${col}${row}`];
      if (cell && cell.t === 'n') cell.z = format;
    }
  }
}

export function buildSalesWorkbook(
  sales: ExportSale[],
  options: ExportOptions
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const money = moneyFormat(options.currency);

  // ---------------------------------------------------------------- Summary

  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const totalDiscount = sales.reduce((sum, sale) => sum + sale.discount, 0);
  const itemsSold = sales.reduce(
    (sum, sale) => sum + sale.items.reduce((n, item) => n + item.quantity, 0),
    0
  );

  const byPayment = sales.reduce<Record<string, number>>((acc, sale) => {
    const label = PAYMENT_LABELS[sale.payment_method];
    acc[label] = (acc[label] ?? 0) + sale.total;
    return acc;
  }, {});

  const summaryRows: (string | number)[][] = [
    [options.schoolName],
    ['Sales report'],
    [],
    ['Period from', options.from],
    ['Period to', options.to],
    ['Generated', new Date().toISOString().slice(0, 19).replace('T', ' ')],
    [],
    ['Sales recorded', sales.length],
    ['Items sold', itemsSold],
    ['Discounts given', totalDiscount],
    ['Total revenue', totalRevenue],
    [],
    ['Revenue by payment method', '']
  ];
  for (const [label, amount] of Object.entries(byPayment)) {
    summaryRows.push([label, amount]);
  }

  const summary = XLSX.utils.aoa_to_sheet(summaryRows);
  summary['!cols'] = widths(28, 20);
  for (const ref of ['B10', 'B11', ...Object.keys(byPayment).map((_, i) => `B${14 + i}`)]) {
    const cell = summary[ref];
    if (cell && cell.t === 'n') cell.z = money;
  }
  XLSX.utils.book_append_sheet(workbook, summary, 'Summary');

  // ------------------------------------------------------------------ Sales

  const salesRows = sales.map((sale) => ({
    'Receipt no.': sale.receipt_no,
    Date: new Date(sale.sold_at),
    Customer: sale.customer_name,
    Student: sale.student_name ?? '',
    Class: sale.class_level ?? '',
    Phone: sale.phone ?? '',
    'Payment method': PAYMENT_LABELS[sale.payment_method],
    Items: sale.items.reduce((n, item) => n + item.quantity, 0),
    Subtotal: sale.subtotal,
    Discount: sale.discount,
    Total: sale.total,
    'Served by': sale.seller_name,
    Notes: sale.notes ?? ''
  }));

  const salesSheet = XLSX.utils.json_to_sheet(salesRows, { cellDates: true });
  salesSheet['!cols'] = widths(16, 18, 24, 24, 10, 16, 16, 8, 14, 14, 14, 20, 30);
  salesSheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: 12, r: Math.max(salesRows.length, 1) }
    })
  };
  // Freeze the header row.
  salesSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  applyNumberFormat(salesSheet, ['I', 'J', 'K'], salesRows.length, money);
  applyNumberFormat(salesSheet, ['B'], salesRows.length, 'yyyy-mm-dd hh:mm');
  XLSX.utils.book_append_sheet(workbook, salesSheet, 'Sales');

  // ------------------------------------------------------------------ Items

  const itemRows = sales.flatMap((sale) =>
    sale.items.map((item) => ({
      'Receipt no.': sale.receipt_no,
      Date: new Date(sale.sold_at),
      Customer: sale.customer_name,
      Description: item.description,
      Size: item.size ?? '',
      'Unit price': item.unit_price,
      Qty: item.quantity,
      Amount: item.line_total,
      'Served by': sale.seller_name
    }))
  );

  const itemsSheet = XLSX.utils.json_to_sheet(itemRows, { cellDates: true });
  itemsSheet['!cols'] = widths(16, 18, 24, 32, 8, 14, 8, 14, 20);
  itemsSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  applyNumberFormat(itemsSheet, ['F', 'H'], itemRows.length, money);
  applyNumberFormat(itemsSheet, ['B'], itemRows.length, 'yyyy-mm-dd hh:mm');
  XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Items');

  return workbook;
}

// ---------------------------------------------------- daily reconciliation

export type ReconExportOptions = {
  from: string;
  to: string;
  currency: string;
  schoolName: string;
  /** When the file was produced and by whom -- A-FR-12.5 requires both stamped. */
  generatedAt: string;
  generatedBy: string;
};

const methodLabel = (m: PaymentMethod) => PAYMENT_LABELS[m];

/**
 * Daily cash reconciliation workbook (A-FR-12.1, exported per A-FR-12.5).
 *
 * Cash and mobile money stay on separate lines here exactly as on screen: the
 * Summary sheet gives the box figure (cash only) and the mobile-money total to
 * verify as two distinct rows, never a combined one. The generation stamp
 * (date, user, filters) sits at the top of the Summary sheet.
 */
export function buildReconciliationWorkbook(
  recon: DailyReconciliation,
  options: ReconExportOptions
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const money = moneyFormat(options.currency);

  // ---------------------------------------------------------------- Summary
  const summaryRows: (string | number)[][] = [
    [options.schoolName],
    ['Daily cash reconciliation'],
    [],
    ['Period from', options.from],
    ['Period to', options.to],
    ['Generated', options.generatedAt],
    ['Generated by', options.generatedBy],
    [],
    ['Transactions', recon.transactionCount],
    ['Gross sales', recon.grossSales],
    ['Discounts', recon.discountsTotal],
    ['Net collected', recon.netCollected],
    [],
    ['Net cash in the box (cash only)', recon.netCashInBox],
    ['Mobile money to verify', recon.mobileMoney.total],
    ['Money for undelivered orders', recon.undeliveredOrdersTotal]
  ];

  const summary = XLSX.utils.aoa_to_sheet(summaryRows);
  summary['!cols'] = widths(32, 24);
  // Money cells: gross/discount/net (rows 10-12) and the three headline figures
  // (rows 14-16). Transactions (row 9) is a count, deliberately left unformatted.
  for (const ref of ['B10', 'B11', 'B12', 'B14', 'B15', 'B16']) {
    const cell = summary[ref];
    if (cell && cell.t === 'n') cell.z = money;
  }
  XLSX.utils.book_append_sheet(workbook, summary, 'Summary');

  // --------------------------------------------------- per-method breakdowns
  const methodSheet = (rows: MethodTotal[]) => {
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((r) => ({ Method: methodLabel(r.method), Count: r.count, Total: r.total })),
      { cellDates: true }
    );
    sheet['!cols'] = widths(18, 10, 16);
    applyNumberFormat(sheet, ['C'], rows.length, money);
    return sheet;
  };
  XLSX.utils.book_append_sheet(workbook, methodSheet(recon.byMethod), 'By method');
  XLSX.utils.book_append_sheet(workbook, methodSheet(recon.refundsByMethod), 'Refunds');

  // --------------------------------------------- mobile money (with reference)
  const mmRows = recon.mobileMoney.transactions.map((t) => ({
    'Receipt no.': t.receiptNo,
    Method: methodLabel(t.method),
    Reference: t.reference ?? '',
    'Received by': t.receiver,
    Amount: t.amount
  }));
  const mmSheet = XLSX.utils.json_to_sheet(mmRows);
  mmSheet['!cols'] = widths(16, 14, 24, 20, 16);
  mmSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  applyNumberFormat(mmSheet, ['E'], mmRows.length, money);
  XLSX.utils.book_append_sheet(workbook, mmSheet, 'Mobile money');

  // ------------------------------------------------------------- by receiver
  const receiverRows = recon.byReceiver.map((r) => ({
    'Received by': r.name,
    Count: r.count,
    Total: r.total
  }));
  const receiverSheet = XLSX.utils.json_to_sheet(receiverRows);
  receiverSheet['!cols'] = widths(24, 10, 16);
  applyNumberFormat(receiverSheet, ['C'], receiverRows.length, money);
  XLSX.utils.book_append_sheet(workbook, receiverSheet, 'By receiver');

  // --------------------------------------------------------------- discounts
  const discountRows = recon.discounts.map((d) => ({
    'Receipt no.': d.receiptNo,
    Reason: d.reason ?? '',
    Amount: d.amount
  }));
  const discountSheet = XLSX.utils.json_to_sheet(discountRows);
  discountSheet['!cols'] = widths(16, 40, 16);
  applyNumberFormat(discountSheet, ['C'], discountRows.length, money);
  XLSX.utils.book_append_sheet(workbook, discountSheet, 'Discounts');

  // ----------------------------------------------------------- cancellations
  const cancelRows = recon.cancellations.map((c) => ({
    'Order no.': c.orderNo,
    Item: c.description,
    Reason: c.reason ?? '',
    'Refund method': c.refundMethod ? methodLabel(c.refundMethod) : '',
    When: c.at ? new Date(c.at) : '',
    Amount: c.amount
  }));
  const cancelSheet = XLSX.utils.json_to_sheet(cancelRows, { cellDates: true });
  cancelSheet['!cols'] = widths(16, 32, 30, 16, 18, 16);
  cancelSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  applyNumberFormat(cancelSheet, ['F'], cancelRows.length, money);
  applyNumberFormat(cancelSheet, ['E'], cancelRows.length, 'yyyy-mm-dd hh:mm');
  XLSX.utils.book_append_sheet(workbook, cancelSheet, 'Cancellations');

  // -------------------------------------------------------- out of policy
  // The day's overrides (A-FR-8.12), the same rows flagged on screen.
  const oopRows = recon.outOfPolicy.map((r) => ({
    'Return no.': r.returnNo,
    'Sale ref.': r.saleRef,
    Kind: r.kind,
    Condition: r.condition,
    'Elapsed days': r.elapsedDays ?? '',
    Reason: r.reason ?? '',
    When: r.at ? new Date(r.at) : ''
  }));
  const oopSheet = XLSX.utils.json_to_sheet(oopRows, { cellDates: true });
  oopSheet['!cols'] = widths(16, 16, 12, 12, 12, 36, 18);
  oopSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  applyNumberFormat(oopSheet, ['G'], oopRows.length, 'yyyy-mm-dd hh:mm');
  XLSX.utils.book_append_sheet(workbook, oopSheet, 'Out of policy');

  return workbook;
}

export function reconciliationReportFilename(from: string, to: string): string {
  return from === to
    ? `reconciliation-${from}.xlsx`
    : `reconciliation-${from}-to-${to}.xlsx`;
}

// ------------------------------------------------------ generic report suite

/**
 * Builds a workbook for any A-FR-12.3 report from its generic ReportResult. A
 * stamped Summary sheet (school, title, filters, generation date + user) then a
 * Data sheet whose money/date columns are number-formatted from the column type.
 * Same stamp the print view shows, so PDF and Excel of one report agree.
 */
export function buildReportWorkbook(
  result: ReportResult,
  stamp: ReportStamp,
  currency: string
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const money = moneyFormat(currency);

  const summary = XLSX.utils.aoa_to_sheet([
    [stamp.schoolName],
    [result.title],
    [],
    ['Period from', stamp.from],
    ['Period to', stamp.to],
    ['Generated', stamp.generatedAt],
    ['Generated by', stamp.generatedBy]
  ]);
  summary['!cols'] = widths(28, 28);
  XLSX.utils.book_append_sheet(workbook, summary, 'Summary');

  // Header row from localised labels, then each row in column order. Dates go in
  // as Date objects so Excel treats them as dates, not strings.
  const header = result.columns.map((col) => col.label);
  const toCell = (value: unknown, type: string) => {
    // Totals rows can carry a text label in a date column; only convert real
    // dates, leave anything unparseable as its original value.
    if ((type === 'date' || type === 'datetime') && typeof value === 'string' && value) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return value ?? '';
  };
  const body = result.rows.map((row) => result.columns.map((col) => toCell(row[col.key], col.type)));
  if (result.totals) {
    body.push(result.columns.map((col) => toCell(result.totals![col.key], col.type)));
  }

  const sheet = XLSX.utils.aoa_to_sheet([header, ...body], { cellDates: true });
  sheet['!cols'] = result.columns.map((col) => ({
    wch: col.type === 'text' ? 28 : col.type === 'datetime' ? 20 : 14
  }));
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 };

  const colLetter = (i: number) => XLSX.utils.encode_col(i);
  result.columns.forEach((col, i) => {
    if (col.type === 'money') applyNumberFormat(sheet, [colLetter(i)], body.length, money);
    if (col.type === 'date') applyNumberFormat(sheet, [colLetter(i)], body.length, 'yyyy-mm-dd');
    if (col.type === 'datetime') applyNumberFormat(sheet, [colLetter(i)], body.length, 'yyyy-mm-dd hh:mm');
  });

  XLSX.utils.book_append_sheet(workbook, sheet, 'Data');
  return workbook;
}

/** Kept for call-site symmetry with the other filename helpers. */
export function reportFilename(key: ReportKey, from: string, to: string): string {
  return from === to ? `${key}-${from}.xlsx` : `${key}-${from}-to-${to}.xlsx`;
}

/** Alias so the server action can name it plainly. */
export const buildGenericReportWorkbook = buildReportWorkbook;

/** Server side: workbook -> bytes, ready to be handed to the browser. */
export function workbookToUint8Array(workbook: XLSX.WorkBook): Uint8Array {
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
}

export function salesReportFilename(from: string, to: string): string {
  return `sales-${from}-to-${to}.xlsx`;
}

/** Browser side: bytes -> saved file. */
export function downloadBytes(
  bytes: ArrayBuffer | Uint8Array,
  filename: string
): void {
  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick; Safari needs the URL alive during the click.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
