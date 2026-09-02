/**
 * The five printed documents (A-FR-7.1).
 *
 * Deliberately NOT in the actions file: a `'use server'` module may export only
 * async functions, so constants and pure helpers living there is a build error
 * that neither tsc nor ESLint reports.
 */

export const DOCUMENT_KINDS = [
  'sale',
  'order',
  'collection',
  'alteration',
  'return'
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** One reference series each, fixed codes rather than abbreviations (A-FR-7.3). */
export const DOCUMENT_PREFIX: Record<DocumentKind, string> = {
  sale: 'SAL',
  order: 'ORD',
  collection: 'COL',
  alteration: 'ALT',
  return: 'RTN'
};

export type DocumentRow = {
  kind: DocumentKind;
  id: string;
  reference: string;
  issued_at: string;
  customer_name: string;
  /** Signed for returns: negative is a refund, positive a difference collected. */
  amount: number;
  /** How many duplicates have been issued (A-FR-7.12). */
  reprint_count: number;
};

export const DOCUMENTS_PAGE_SIZE = 25;

/**
 * Where a document's printable sheet lives.
 *
 * Each kind already had a page before this screen existed; the ledger links to
 * them rather than re-rendering anything, so there is still exactly one place
 * each document is drawn.
 */
export function hrefForDocument(kind: DocumentKind, id: string): string {
  switch (kind) {
    case 'sale':
      return `/sales/${id}/receipt`;
    case 'order':
      return `/orders/${id}/receipt`;
    case 'collection':
      return `/collections/${id}`;
    case 'alteration':
      return `/alterations/${id}/slip`;
    case 'return':
      return `/returns/${id}/receipt`;
  }
}

/**
 * The same sheet, asked for as a duplicate. Rendering that URL stamps
 * DUPLICATA / DUPLICATE and writes the audit row (A-FR-7.12) -- which is why
 * the ledger links to it rather than reimplementing either.
 */
export function reprintHref(kind: DocumentKind, id: string): string {
  return `${hrefForDocument(kind, id)}?reprint=1`;
}
