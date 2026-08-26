import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';
import { requireSupabaseEnv } from './env';

/**
 * Supabase client for Client Components. Safe to call at module scope --
 * `createBrowserClient` memoises the underlying instance per browser session.
 */
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
