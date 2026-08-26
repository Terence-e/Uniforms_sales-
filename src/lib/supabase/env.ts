export type SupabaseEnv = { url: string; anonKey: string };

/**
 * Reads the Supabase credentials, returning null when the project has not been
 * configured yet.
 *
 * `.env.example` ships `<project-ref>` placeholders, and an unedited value is a
 * syntactically malformed URL. Catching that here means a fresh clone redirects
 * to the login screen instead of throwing "Invalid supabaseUrl" from somewhere
 * three layers down.
 *
 * The `process.env.*` lookups are written out literally so Next can inline them
 * into the client bundle -- don't refactor them behind a variable.
 */
export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  if (url.includes('<') || anonKey.includes('<')) return null;

  try {
    new URL(url);
  } catch {
    return null;
  }

  return { url, anonKey };
}

/** For call sites that cannot proceed without a connection. */
export function requireSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();
  if (!env) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env.local and set ' +
        'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return env;
}
