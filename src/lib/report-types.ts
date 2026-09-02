/**
 * Shared shape for the A-FR-12.3 report suite. Every report -- however it is
 * queried -- is normalised to this generic table so that ONE renderer, ONE
 * Excel builder and ONE print view can serve all of them. Adding a report is
 * adding a query that returns this shape, nothing more.
 *
 * Isomorphic on purpose (no server/xlsx imports): the client table, the server
 * Excel builder and the print view all import from here.
 */

export type ReportColumnType = 'text' | 'number' | 'money' | 'date' | 'datetime';

export interface ReportColumn {
  key: string;
  /** Already localised by the server action that built the result. */
  label: string;
  type: ReportColumnType;
}

export type ReportCell = string | number | null;
export type ReportRow = Record<string, ReportCell>;

export interface ReportResult {
  key: string;
  /** Localised report name, used as the sheet/print title. */
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Optional trailing summary row (e.g. totals / averages). */
  totals?: ReportRow | null;
}

/** Generation provenance stamped on every export (A-FR-12.5). */
export interface ReportStamp {
  schoolName: string;
  generatedAt: string;
  generatedBy: string;
  from: string;
  to: string;
}

export const REPORT_KEYS = [
  'sales-by-period',
  'sales-by-garment',
  'production',
  'orders-turnaround',
  'returns-exchanges',
  'cancellations',
  'audit'
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

export function isReportKey(value: string): value is ReportKey {
  return (REPORT_KEYS as readonly string[]).includes(value);
}
