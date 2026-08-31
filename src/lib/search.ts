/**
 * Shapes and constants for the unified search (A-FR-7.6).
 *
 * Deliberately NOT in actions/search.ts: a 'use server' file may only export
 * async functions, so a plain constant there is a build error rather than a
 * style problem. Types are erased and would survive, but keeping them with the
 * constant means one obvious home for "what a search result is" and one for
 * "how a search is run".
 */

export type TransactionKind = 'sale' | 'order' | 'alteration';

export type SearchHit = {
  kind: TransactionKind;
  id: string;
  reference: string;
  occurredAt: string;
  customerName: string;
  studentName: string | null;
  phone: string | null;
  /** Null for sales, which have no status -- a sale simply happened. */
  status: string | null;
  amount: number;
};

export type SearchResults = {
  hits: SearchHit[];
  /** Across the whole match, not just this page. */
  total: number;
  page: number;
  pageSize: number;
};

export const SEARCH_PAGE_SIZE = 20;

/** Where a hit lives, so a result can be opened. */
export function hrefForHit(hit: SearchHit): string {
  switch (hit.kind) {
    case 'sale':
      return `/sales/${hit.id}/receipt`;
    case 'order':
      return `/orders/${hit.id}`;
    case 'alteration':
      return `/alterations/${hit.id}`;
  }
}
