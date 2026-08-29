import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/types/database.types';

/**
 * Appends an entry to the audit log. Uses the service role because some events
 * (failed logins) happen with no signed-in user. Never throws -- auditing must
 * not break the request it is recording.
 */
export async function logAudit(entry: {
  actorId?: string | null;
  action: string;
  entity?: string | null;
  ip?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    await admin.from('audit_log').insert({
      actor_id: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity ?? null,
      ip: entry.ip ?? null,
      meta: (entry.meta ?? {}) as Json
    });
  } catch {
    // swallow
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
