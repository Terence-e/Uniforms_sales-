'use server';

import { createClient } from '@/lib/supabase/server';
import {
  DOCUMENTS_PAGE_SIZE,
  type DocumentKind,
  type DocumentRow
} from '@/lib/documents';

/**
 * The document ledger (A-FR-7.1, A-FR-7.12).
 *
 * Thin: `list_documents()` does the union, the filtering, the ordering, the
 * pagination and the reprint counts, because merging five tables in JavaScript
 * would mean fetching every row of all five to sort and count them -- which is
 * what pagination exists to avoid.
 *
 * The function is SECURITY INVOKER, so RLS decides what each role sees. No
 * permission logic is repeated here.
 */

export type DocumentPage = {
  rows: DocumentRow[];
  total: number;
};

export async function listDocuments(params: {
  kinds?: DocumentKind[];
  from?: string | null;
  to?: string | null;
  page?: number;
}): Promise<DocumentPage> {
  const supabase = await createClient();
  const page = Math.max(params.page ?? 1, 1);

  const { data, error } = await supabase.rpc('list_documents', {
    // An empty selection means "all", not "none": a filter nobody has touched
    // should show everything, and the function reads null the same way.
    p_kinds: params.kinds && params.kinds.length > 0 ? params.kinds : null,
    p_from: params.from || null,
    p_to: params.to || null,
    p_limit: DOCUMENTS_PAGE_SIZE,
    p_offset: (page - 1) * DOCUMENTS_PAGE_SIZE
  });

  if (error || !data) return { rows: [], total: 0 };

  const rows = data as (DocumentRow & { total_count: number })[];
  return {
    rows: rows.map(({ total_count: _total, ...row }) => row),
    // The window function repeats the total on every row, so any row carries
    // it. Zero rows legitimately means zero documents.
    total: rows.length > 0 ? Number(rows[0].total_count) : 0
  };
}
