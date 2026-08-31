'use server';

import { createClient } from '@/lib/supabase/server';

export type AppNotification = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

/** The signed-in user's notifications, newest first. */
export async function listNotifications(): Promise<AppNotification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('notifications')
    .select('id, type, data, link, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(60);
  return (data ?? []).map((n) => ({
    ...n,
    data: (n.data as Record<string, unknown>) ?? {}
  }));
}

export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  return { ok: true as const };
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
  return { ok: true as const };
}

export async function deleteNotification(id: string) {
  const supabase = await createClient();
  await supabase.from('notifications').delete().eq('id', id);
  return { ok: true as const };
}

export async function clearNotifications() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };
  await supabase.from('notifications').delete().eq('user_id', user.id);
  return { ok: true as const };
}
