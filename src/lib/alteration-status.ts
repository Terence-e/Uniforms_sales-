import type { AlterationStatus } from '@/types/database.types';

/**
 * The alteration status sequence and the rules for moving along it.
 *
 * These mirror `enforce_alteration_transition()` in
 * supabase/migrations/20260101001700_alteration_transitions.sql. The database
 * is the authority -- it rejects an illegal move whatever the UI believes --
 * but the screen needs the same rules to decide which buttons to draw, and
 * asking the server what a button should say is a round trip for a constant.
 *
 * Deliberately the same shape as lib/order-status.ts. A seller should not have
 * to remember which kind of job lets them skip a step.
 *
 * If you change the sequence, change it in both places.
 */

/** The live states, in order. `cancelled` is absent on purpose: it is reachable
 *  from any live state and is not a step along the line. */
export const ALTERATION_STATUS_SEQUENCE = [
  'received',
  'in_progress',
  'ready',
  'returned'
] as const satisfies readonly AlterationStatus[];

export type LiveAlterationStatus = (typeof ALTERATION_STATUS_SEQUENCE)[number];

/** Terminal states. A returned garment is back with its owner; reopening that
 *  is a new alteration, not a status change. */
export function isTerminal(status: AlterationStatus): boolean {
  return status === 'returned' || status === 'cancelled';
}

function rank(status: AlterationStatus): number {
  return (ALTERATION_STATUS_SEQUENCE as readonly AlterationStatus[]).indexOf(status);
}

/** The one step forward, or null when there isn't one. */
export function nextStatus(status: AlterationStatus): LiveAlterationStatus | null {
  const i = rank(status);
  if (i < 0 || i >= ALTERATION_STATUS_SEQUENCE.length - 1) return null;
  return ALTERATION_STATUS_SEQUENCE[i + 1];
}

/** The one step back, or null when there isn't one. Always needs a reason. */
export function previousStatus(status: AlterationStatus): LiveAlterationStatus | null {
  const i = rank(status);
  if (i <= 0) return null;
  return ALTERATION_STATUS_SEQUENCE[i - 1];
}

export function canCancel(status: AlterationStatus): boolean {
  return !isTerminal(status);
}

/** Still the school's problem: shows on the open-jobs list, not yet closed. */
export function isOpen(status: AlterationStatus): boolean {
  return !isTerminal(status);
}

/**
 * Money still owed on this alteration.
 *
 * Payment may be taken at intake or on return -- the shop does both -- so the
 * schema records WHETHER it has been paid rather than assuming WHEN. This is
 * the one place that reads that, so the slip, the detail page and the list all
 * agree.
 */
export function amountDue(alteration: {
  charge: number;
  paid_at: string | null;
}): number {
  if (alteration.charge <= 0) return 0;
  return alteration.paid_at ? 0 : alteration.charge;
}
