'use server';

import { createClient } from '@/lib/supabase/server';
import { SEARCH_PAGE_SIZE, type SearchResults, type TransactionKind } from '@/lib/search';

/**
 * Unified search across sales, orders and alterations (A-FR-7.6).
 *
 * All the work happens in `search_transactions()`. It runs as the caller, so
 * RLS decides what comes back -- a seller finds their own transactions, an
 * oversight role finds everything -- and no permission logic is repeated here.
 */

export async function searchTransactions(params: {
  term?: string | null;
  kinds?: TransactionKind[] | null;
  stage?: string | null;
  from?: string | null;
  to?: string | null;
  page?: number;
}): Promise<SearchResults> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);

  const { data } = await supabase.rpc('search_transactions', {
    p_term: params.term?.trim() || null,
    p_kinds: params.kinds && params.kinds.length > 0 ? params.kinds : null,
    p_stage: params.stage || null,
    p_from: params.from || null,
    p_to: params.to || null,
    p_limit: SEARCH_PAGE_SIZE,
    p_offset: (page - 1) * SEARCH_PAGE_SIZE
  });

  const rows = data ?? [];

  return {
    // total_count rides on every row -- a window count over the full match --
    // so the page can say "34 results" while holding twenty of them. Zero rows
    // means zero matches, which is the only case where it is absent.
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    pageSize: SEARCH_PAGE_SIZE,
    hits: rows.map((row) => ({
      kind: row.kind as TransactionKind,
      id: row.id,
      reference: row.reference,
      occurredAt: row.occurred_at,
      customerName: row.customer_name,
      studentName: row.student_name,
      phone: row.phone,
      status: row.status,
      amount: row.amount
    }))
  };
}
