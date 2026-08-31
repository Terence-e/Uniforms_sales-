import * as XLSX from 'xlsx';
import type { PaymentMethod } from '@/types/database.types';

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
