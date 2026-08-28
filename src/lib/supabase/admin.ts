import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Service-role Supabase client. **Bypasses RLS** — never import this into a
 * Client Component, and only call it after verifying the caller server-side.
 * Used for the admin-only user-management operations (creating accounts).
 *
 * Only ever call from Server Actions / Server Components: the service-role key is
 * a server-only env var, so a browser import throws here rather than leaking it.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
