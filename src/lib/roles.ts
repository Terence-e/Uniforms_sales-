import type { UserRole } from '@/types/database.types';

/**
 * Roles that can write anywhere in the system. Administration is deliberately
 * excluded -- A-FR-2.2 says the role "has no write path anywhere in the
 * system" -- and the database enforces the identical list independently via
 * can_operate() in every RLS policy that gates a write.
 *
 * This mirror exists so the interface can stop OFFERING a control the server
 * will refuse. It changes nothing about what is actually permitted: hiding a
 * button is not a permission check (P-3), and every write path this flag
 * hides is still refused server-side if reached directly. The single source
 * of truth for what CAN happen stays can_operate(); this is only for what the
 * UI SHOWS.
 */
export const OPERATOR_ROLES: readonly UserRole[] = ['seller', 'maintenance', 'super_admin'];

export function canOperate(role: UserRole | null | undefined): boolean {
  return role != null && OPERATOR_ROLES.includes(role);
}
