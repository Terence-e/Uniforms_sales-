'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  emptyLoginState,
  loginSchema,
  type LoginState
} from '@/lib/validation/auth-schema';

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    // Deliberately vague: don't reveal whether the address has an account.
    return { error: 'invalidCredentials', fieldErrors: {} };
  }

  const locale = await getLocale();
  revalidatePath('/', 'layout');

  // Every user's first screen is their role dashboard overview -- always, even
  // when they were deep-linking somewhere else. The locale-aware `redirect`
  // adds the locale prefix itself, so the path passed in must not carry one.
  redirect({ href: '/dashboard', locale });

  // `redirect` throws, so this is unreachable -- it only exists because the
  // helper isn't typed as `never` and useActionState needs a concrete state type.
  return emptyLoginState;
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const locale = await getLocale();
  revalidatePath('/', 'layout');
  redirect({ href: '/login', locale });
}

/** The signed-in user's profile, or null. Used by the dashboard shell. */
export async function getProfile() {
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

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: full_name.slice(0, 120), avatar_url: input.avatar_url })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Count of active accounts. Only meaningful for oversight roles (RLS scopes it);
 * used on the Super Admin dashboard. */
export async function countActiveUsers() {
  const supabase = await createClient();
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  return count ?? 0;
}
