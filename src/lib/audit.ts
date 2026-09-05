import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/types/database.types';

/**
 * Appends an entry to the audit log (spec A-11). Uses the service role because
 * some events (failed logins) happen with no signed-in user, and because the log
 * must be written even when the acting user's RLS would not let them insert.
 * Never throws -- auditing must not break the request it is recording.
 *
 * `actorName` is denormalised onto the row so the viewer can show who did what
 * for EVERY role (A-FR-11.4) without reading public.profiles, and so a later
 * rename or account deletion never rewrites history. When omitted it is looked
 * up once from the actor's profile.
 */
export async function logAudit(entry: {
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  entity?: string | null;
  ip?: string | null;
  targetTable?: string | null;
  targetId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  meta?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();

    let actorName = entry.actorName ?? null;
    if (!actorName && entry.actorId) {
      const { data } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', entry.actorId)
        .single();
      actorName = data?.full_name || null;
    }

    await admin.from('audit_log').insert({
      actor_id: entry.actorId ?? null,
      actor_name: actorName,
      action: entry.action,
      entity: entry.entity ?? null,
      ip: entry.ip ?? null,
      target_table: entry.targetTable ?? null,
      target_id: entry.targetId ?? null,
      previous_value: (entry.previousValue ?? null) as Json,
      new_value: (entry.newValue ?? null) as Json,
      meta: (entry.meta ?? {}) as Json
    });
  } catch {
    // swallow -- see doc comment
  }
}

/** Failed sign-ins for `email` within the window (default 5 min) -- drives the
 * login lockout. */
export async function countRecentFailedLogins(email: string, windowMs = 5 * 60 * 1000) {
  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - windowMs).toISOString();
    const { count } = await admin
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'login_failed')
      .gte('created_at', since)
      .contains('meta', { email });
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ------------------------------------------------------------------ viewer

export type AuditFilters = {
  from?: string; // yyyy-mm-dd (inclusive)
  to?: string; // yyyy-mm-dd (inclusive)
  actorId?: string;
  action?: string;
};

export type AuditEntry = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  previous_value: Json | null;
  new_value: Json | null;
  ip: string | null;
  meta: Json;
  created_at: string;
};

/**
 * Reads the audit log for the viewer, honouring the date / user / action-type
 * filters (A-FR-11.4). Goes through the normal (RLS) client, not the service
 * role: the audit_select_all policy makes it readable by every role, which is
 * exactly the guarantee we want to exercise here.
 */
export async function listAuditLog(filters: AuditFilters = {}, limit = 250): Promise<AuditEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from('audit_log')
    .select(
      'id, actor_id, actor_name, action, target_table, target_id, previous_value, new_value, ip, meta, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filters.from) query = query.gte('created_at', new Date(`${filters.from}T00:00:00`).toISOString());
  if (filters.to) query = query.lte('created_at', new Date(`${filters.to}T23:59:59.999`).toISOString());
  if (filters.actorId) query = query.eq('actor_id', filters.actorId);
  if (filters.action) query = query.eq('action', filters.action);

  const { data } = await query;
  return (data ?? []) as AuditEntry[];
}

/**
 * Distinct actors that appear in the log, for the viewer's "user" filter. Reads
 * audit_log (select-all) rather than profiles, so it works for every role even
 * though non-oversight roles cannot list profiles.
 */
export async function listAuditActors(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('audit_log')
    .select('actor_id, actor_name')
    .not('actor_id', 'is', null)
    .limit(2000);

  const byId = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.actor_id) byId.set(row.actor_id, row.actor_name || row.actor_id);
  }
  return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/**
 * The canonical action types the app can emit, grouped for the viewer's
 * action-type filter. Keeping the list here (not just as free strings at each
 * call site) keeps the filter and the writers in sync.
 */
export const AUDIT_ACTIONS = [
  'login_success',
  'login_failed',
  'login_blocked',
  'sale_created',
  'export_generated',
  'product_created',
  'product_updated',
  'price_changed',
  'product_archived',
  'product_restored',
  'stock_movement',
  'account_created',
  'account_password_reset',
  'account_activated',
  'account_deactivated',
  'account_deleted',
  'profile_updated',
  'password_changed'
] as const;
