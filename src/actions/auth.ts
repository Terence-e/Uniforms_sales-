'use server';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { redirect } from '@/i18n/navigation';
import { logAudit, countRecentFailedLogins } from '@/lib/audit';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSupabaseEnv } from '@/lib/supabase/env';
import {
  changePasswordSchema,
  emptyLoginState,
  loginSchema,
  type LoginState
} from '@/lib/validation/auth-schema';

async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return h.get('x-real-ip');
}

export async function signIn(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    redirectTo: formData.get('redirectTo') || null
  });

  if (!parsed.success) {
    const fieldErrors: LoginState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === 'email' || field === 'password') {
        fieldErrors[field] ??= issue.message;
      }
    }
    return { error: null, fieldErrors };
  }

  const email = parsed.data.email;
  const ip = await getClientIp();

  // Rate limit: after 5 failed attempts in 5 minutes, lock this email out until
  // the failures age out of the window. The 6th attempt in a row is refused.
  if ((await countRecentFailedLogins(email)) >= 5) {
    await logAudit({ action: 'login_blocked', ip, meta: { email } });
    return { error: 'tooManyAttempts', fieldErrors: {} };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password
  });

  if (error) {
    await logAudit({ action: 'login_failed', ip, meta: { email } });
    // Deliberately vague: don't reveal whether the address has an account.
    return { error: 'invalidCredentials', fieldErrors: {} };
  }

  // A-FR-P4: a deactivated account cannot log in. Credentials still verify (so we
  // do not leak whether the address exists), but the session is dropped
  // immediately and login is refused.
  const { data: prof } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', data.user!.id)
    .single();
  if (prof && !prof.is_active) {
    await supabase.auth.signOut();
    await logAudit({ action: 'login_blocked', ip, meta: { email, reason: 'inactive' } });
    return { error: 'accountInactive', fieldErrors: {} };
  }

  await logAudit({ actorId: data.user?.id ?? null, action: 'login_success', ip, meta: { email } });

  // Stamp the session start so the proxy can enforce a per-role timeout.
  const cookieStore = await cookies();
  cookieStore.set('session_started', String(Date.now()), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production'
  });

  const locale = await getLocale();
  revalidatePath('/', 'layout');

  // Sent to the locale index rather than to a named screen, because where a
  // user starts depends on their role -- a seller lands on the open-jobs board,
  // everyone else on the dashboard -- and that rule lives in one place,
  // app/[locale]/page.tsx. Hard-coding a destination here would be a second
  // copy of it that quietly drifts.
  //
  // Still ignores `redirectTo`: the first screen after signing in is the one
  // the role calls for, even when the user was deep-linking somewhere else.
  redirect({ href: '/', locale });

  // `redirect` throws, so this is unreachable -- it only exists because the
  // helper isn't typed as `never` and useActionState needs a concrete state type.
  return emptyLoginState;
}

/**
 * A signed-out user asks for a password reset. Per A-FR-3.5 there is no
 * self-service email reset: instead every active Super Admin is notified in-app
 * and issues a temporary password. Always resolves the same way regardless of
 * whether the address exists, so the form can't be used to enumerate accounts.
 */
export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  const clean = email.trim().toLowerCase();
  if (clean.includes('@')) {
    try {
      const admin = createAdminClient();
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const target = list?.users.find((u) => u.email?.toLowerCase() === clean);
      if (target) {
        const { data: admins } = await admin
          .from('profiles')
          .select('id')
          .eq('role', 'super_admin')
          .eq('is_active', true);
        const ids = (admins ?? []).map((a) => a.id);
        if (ids.length > 0) {
          await admin.from('notifications').insert(
            ids.map((user_id) => ({
              user_id,
              type: 'password_reset_request',
              link: '/accounts',
              data: { email: clean, targetUserId: target.id }
            }))
          );
        }
      }
    } catch {
      // Never surface an error to the requester.
    }
  }
  return { ok: true };
}

export type ChangePasswordResult =
  | { ok: true }
  | {
      ok: false;
      error?: string;
      fieldErrors?: { current?: string; password?: string; confirm?: string };
    };

/**
 * Sets a new password for the signed-in user and clears the forced-change flag
 * (must_change_password). The current password must be supplied and is verified
 * first. Everything is re-checked on the server, not trusted from the client.
 */
export async function changePassword(input: {
  current: string;
  password: string;
  confirm: string;
}): Promise<ChangePasswordResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: { current?: string; password?: string; confirm?: string } = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === 'current' || field === 'password' || field === 'confirm') {
        fieldErrors[field] ??= issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: 'unauthorized' };

  // Verify the current password with a throwaway client so we don't disturb the
  // live session cookies. A failed sign-in means the current password is wrong.
  const { url, anonKey } = requireSupabaseEnv();
  const verifier = createSupabaseJsClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { error: verifyErr } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current
  });
  if (verifyErr) return { ok: false, fieldErrors: { current: 'incorrectPassword' } };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
    data: { ...user.user_metadata, must_change_password: false }
  });
  if (error) return { ok: false, error: error.message };

  // Audited (A-FR-11.1). The password itself is never recorded.
  await logAudit({
    actorId: user.id,
    action: 'password_changed',
    targetTable: 'auth.users',
    targetId: user.id,
    ip: await getClientIp()
  });

  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const locale = await getLocale();
  revalidatePath('/', 'layout');
  redirect({ href: '/login', locale });
}

// Memoised per request: the layout, the page and any actions in the same render
// share a single auth + profile round-trip instead of repeating it each time.
const loadProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active, avatar_url')
    .eq('id', user.id)
    .single();

  if (!data) return null;
  return { ...data, email: user.email ?? '' };
});

/** The signed-in user's profile, or null. Used by the dashboard shell. */
export async function getProfile() {
  return loadProfile();
}

export type UpdateProfileResult = { ok: true } | { ok: false; error: string };

/**
 * Updates the signed-in user's own name and avatar. The avatar is a small
 * client-compressed data URL kept on the row. RLS (profiles_update_self) allows
 * this because the role is left unchanged.
 */
export async function updateOwnProfile(input: {
  full_name: string;
  avatar_url: string | null;
}): Promise<UpdateProfileResult> {
  const full_name = input.full_name.trim();
  if (!full_name) return { ok: false, error: 'nameRequired' };
  // Guard against oversized payloads -- avatars are compressed to a small square.
  if (input.avatar_url && input.avatar_url.length > 400_000) {
    return { ok: false, error: 'imageTooLarge' };
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  // Snapshot the "before" so the audit entry records what actually changed.
  const { data: before } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single();

  const nextName = full_name.slice(0, 120);
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: nextName, avatar_url: input.avatar_url })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };

  // Audited (A-FR-11.1). Avatars are large data URLs, so we log whether one is
  // present rather than the bytes.
  await logAudit({
    actorId: user.id,
    action: 'profile_updated',
    targetTable: 'profiles',
    targetId: user.id,
    previousValue: {
      full_name: before?.full_name ?? null,
      has_avatar: Boolean(before?.avatar_url)
    },
    newValue: { full_name: nextName, has_avatar: Boolean(input.avatar_url) }
  });

  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Count of active accounts, shown on every role's dashboard. Goes through the
 * count_active_users() SECURITY DEFINER function so the number is the true team
 * size for everyone, without exposing any profile rows (a direct query would be
 * RLS-scoped to the caller's own row for non-oversight roles). */
export async function countActiveUsers() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('count_active_users');
  return data ?? 0;
}
