import { createAdminClient } from '@/lib/supabase/admin';
import type { Json, UserRole } from '@/types/database.types';

/**
 * App-wide notifications. Any action (or any future feature) records an event by
 * calling `notify()` with a type, the recipients, and a small data bag; the bell
 * renders a bilingual label for the type and falls back to a generic one for a
 * type it doesn't know yet. So adding a notification to a new feature is one
 * `notify()` call plus (optionally) a `Notifications.types.<type>` label -- the
 * system is not tied to any specific action.
 *
 * Rows are written with the service role: recipients don't (and shouldn't) have
 * insert rights on each other's notifications, and the actor is often not the
 * recipient. Never throws -- a notification must not break the thing it reports.
 */

export type NotifyRecipients =
  | { kind: 'roles'; roles: UserRole[] }
  | { kind: 'all' }
  | { kind: 'users'; ids: string[] };

/** Convenience: the oversight roles that watch shop activity. */
export const OVERSIGHT: UserRole[] = ['administration', 'super_admin'];

export async function notify(opts: {
  type: string;
  recipients: NotifyRecipients;
  data?: Record<string, unknown>;
  link?: string | null;
  /** The person who caused the event -- excluded so nobody pings themselves. */
  excludeActorId?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    let ids: string[];
    if (opts.recipients.kind === 'users') {
      ids = opts.recipients.ids;
    } else {
      let query = admin.from('profiles').select('id').eq('is_active', true);
      if (opts.recipients.kind === 'roles') {
        query = query.in('role', opts.recipients.roles);
      }
      const { data } = await query;
      ids = (data ?? []).map((r) => r.id);
    }

    if (opts.excludeActorId) ids = ids.filter((id) => id !== opts.excludeActorId);
    ids = Array.from(new Set(ids));
    if (ids.length === 0) return;

    await admin.from('notifications').insert(
      ids.map((user_id) => ({
        user_id,
        type: opts.type,
        data: (opts.data ?? {}) as Json,
        link: opts.link ?? null
      }))
    );
  } catch {
    // swallow -- notifications are best-effort and must never fail the action
  }
}
