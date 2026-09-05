'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { createAccountSchema, type CreateAccountInput } from '@/lib/validation/auth-schema';

export type CreateAccountResult =
  | { ok: true; email: string }
  | {
      ok: false;
      error?: string;
      fieldErrors?: Partial<Record<'full_name' | 'email' | 'role' | 'password', string>>;
    };

/**
 * Creates a user account with a role and a temporary password (spec A-FR-3.1:
 * accounts are created by the Super Admin only). Enforced server-side — the
 * caller's role is checked here, not just hidden in the UI — so a direct call by
 * a non-super-admin is refused. The new account is flagged must_change_password.
 */
export async function createAccount(
  input: CreateAccountInput
): Promise<CreateAccountResult> {
  const parsed = createAccountSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<
      Record<'full_name' | 'email' | 'role' | 'password', string>
    > = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === 'full_name' || field === 'email' || field === 'role' || field === 'password') {
        fieldErrors[field] ??= issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  // Authorisation: the caller must be a Super Admin. Checked on the server.
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (me?.role !== 'super_admin') return { ok: false, error: 'forbidden' };

  const { full_name, email, role, password } = parsed.data;
  const admin = createAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no public email flow -- confirm immediately (A-FR-3.1)
    user_metadata: { full_name, must_change_password: true }, // forced change (A-FR-3.2)
    app_metadata: { role }
  });
  if (error || !created?.user) {
    return { ok: false, error: error?.message ?? 'createFailed' };
  }

  // profiles.role is the source of truth RLS reads; app_metadata is a convenience copy.
  const { error: pErr } = await admin
    .from('profiles')
    .upsert({ id: created.user.id, full_name, role, is_active: true }, { onConflict: 'id' });
  if (pErr) return { ok: false, error: pErr.message };

  // Audited (A-FR-11.1). The temporary password is never recorded.
  await logAudit({
    actorId: user.id,
    action: 'account_created',
    targetTable: 'profiles',
    targetId: created.user.id,
    newValue: { email, full_name, role }
  });

  revalidatePath('/', 'layout');
  return { ok: true, email };
}

export type AccountActionResult = { ok: true } | { ok: false; error: string };

/** The caller's id iff they are a Super Admin, else null (checked server-side). */
async function requireSuperAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return me?.role === 'super_admin' ? user.id : null;
}

/**
 * Activate or deactivate an account (A-FR-P4). A deactivated user cannot log in
 * (enforced in the login action), but the row stays and their name remains
 * attached to everything they did -- deactivation is not deletion.
 *
 * Super-Admin only, enforced server-side. You cannot deactivate your own
 * account: locking the only Super Admin out of the system is not a mistake the
 * UI should allow. Audited (A-FR-11.1).
 */
export async function setAccountActive(
  userId: string,
  active: boolean
): Promise<AccountActionResult> {
  const uid = await requireSuperAdmin();
  if (!uid) return { ok: false, error: 'forbidden' };
  if (userId === uid) return { ok: false, error: 'cannotSelf' };

  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ is_active: active }).eq('id', userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: uid,
    action: active ? 'account_activated' : 'account_deactivated',
    targetTable: 'profiles',
    targetId: userId,
    newValue: { is_active: active }
  });

  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * Delete an account outright. Super-Admin only. You cannot delete your own.
 *
 * Deleting the auth user cascades to its profile -- but a profile whose name is
 * attached to sales, orders, movements or returns is protected by a foreign key
 * (on delete restrict), so the delete fails and the account should be
 * deactivated instead (P-4). That failure is surfaced as `hasActivity` so the
 * UI can say so rather than showing a raw database error.
 */
export async function deleteAccount(userId: string): Promise<AccountActionResult> {
  const uid = await requireSuperAdmin();
  if (!uid) return { ok: false, error: 'forbidden' };
  if (userId === uid) return { ok: false, error: 'cannotSelf' };

  const admin = createAdminClient();
  // Captured before deletion so the audit row still says who was removed.
  const { data: target } = await admin
    .from('profiles')
    .select('full_name, role')
    .eq('id', userId)
    .single();

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    // Almost always an FK restriction: the account has activity on record.
    return { ok: false, error: 'hasActivity' };
  }

  await logAudit({
    actorId: uid,
    action: 'account_deleted',
    targetTable: 'profiles',
    targetId: userId,
    previousValue: target ?? null
  });

  revalidatePath('/', 'layout');
  return { ok: true };
}

function genTempPassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  const pick = (n: number) =>
    Array.from({ length: n }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  return `Frst-${pick(4)}${Math.floor(1000 + Math.random() * 9000)}`;
}

export type ResetPasswordResult =
  | { ok: true; password: string }
  | { ok: false; error: string };

/**
 * Sets a fresh temporary password for any user (including the Super Admin's own
 * account) and re-flags must_change_password, so the user must change it after
 * logging in with it. Super-Admin-only, enforced server-side. Returns the temp
 * password so it can be shared securely.
 */
export async function resetUserPassword(userId: string): Promise<ResetPasswordResult> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (me?.role !== 'super_admin') return { ok: false, error: 'forbidden' };

  const admin = createAdminClient();
  const { data: target } = await admin.auth.admin.getUserById(userId);
  const meta = (target?.user?.user_metadata ?? {}) as Record<string, unknown>;

  const password = genTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    user_metadata: { ...meta, must_change_password: true }
  });
  if (error) return { ok: false, error: error.message };

  // Resolve any pending reset-request notifications that pointed at this user.
  await admin
    .from('notifications')
    .update({ is_read: true })
    .eq('type', 'password_reset_request')
    .contains('data', { targetUserId: userId });

  // Audited (A-FR-11.1). The new temporary password is never recorded.
  await logAudit({
    actorId: user.id,
    action: 'account_password_reset',
    targetTable: 'profiles',
    targetId: userId
  });

  revalidatePath('/', 'layout');
  return { ok: true, password };
}
