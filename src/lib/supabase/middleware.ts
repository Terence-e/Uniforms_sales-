import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { readSupabaseEnv } from './env';

/**
 * Refreshes the Supabase auth cookies on an existing response object.
 *
 * We take the response as an argument (rather than creating one) so the
 * next-intl middleware can build it first and we only decorate it -- otherwise
 * the two middlewares would fight over who owns the outgoing response.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse
): Promise<User | null> {
  // Before Supabase is configured, everyone is anonymous -- which sends them
  // to the login screen rather than into a dashboard that cannot load data.
  const env = readSupabaseEnv();
  if (!env) return null;

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      }
    }
  });

  // getUser() revalidates the token with Supabase Auth on every request.
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}
