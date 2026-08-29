import type { OrderStatus } from '@/types/database.types';

/**
 * The order status sequence, and the rules for moving along it.
 *
 * These mirror `enforce_order_line_transition()` in
 * supabase/migrations/20260101000900_order_line_status.sql. The database is the
 * authority -- it rejects an illegal move whatever the UI believes -- but the
 * form needs the same rules to decide which buttons to draw, and asking the
 * server what a button should say is a round trip for a constant.
 *
 * If you change the sequence, change it in both places.
 */

/** The live states, in order. `cancelled` is deliberately absent: it is
 *  reachable from any live state and is not a step along the line. */
export const ORDER_STATUS_SEQUENCE = [
  'ordered',
  'in_production',
  'ready',
  'collected'
] as const satisfies readonly OrderStatus[];

export type LiveOrderStatus = (typeof ORDER_STATUS_SEQUENCE)[number];

/** Terminal states: nothing moves out of these. Walking back out of
 *  `collected` is a return, not a status change. */
export function isTerminal(status: OrderStatus): boolean {
  return status === 'collected' || status === 'cancelled';
}

function rank(status: OrderStatus): number {
  return (ORDER_STATUS_SEQUENCE as readonly OrderStatus[]).indexOf(status);
}

/** The one step forward, or null when there isn't one. */
export function nextStatus(status: OrderStatus): LiveOrderStatus | null {
  const i = rank(status);
  if (i < 0 || i >= ORDER_STATUS_SEQUENCE.length - 1) return null;
  return ORDER_STATUS_SEQUENCE[i + 1];
}

/** The one step back, or null when there isn't one. Always needs a reason. */
export function previousStatus(status: OrderStatus): LiveOrderStatus | null {
  const i = rank(status);
  if (i <= 0) return null;
  return ORDER_STATUS_SEQUENCE[i - 1];
}

export function canCancel(status: OrderStatus | null): boolean {
  return status !== null && !isTerminal(status);
}

/**
 * The order-level status, derived rather than stored.
 *
 * `orders.status` was dropped in 20260101000900: an order can mix a line handed
 * over at the counter with lines still outstanding, so a single stored column
 * would have to lie about one of them. What an order "is" now comes from its
 * outstanding lines, computed the same way everywhere:
 *
 * - lines handed over immediately (status null) are ignored -- they were never
 *   part of the workflow
 * - the order shows its LEAST advanced live line, because that is the work
 *   still to do; an order with one shirt ready and one still in production is
 *   in production
 * - if every outstanding line is cancelled, the order is cancelled
 * - an order whose lines were all handed over immediately has no status at all,
 *   and returns null
 */
export function deriveOrderStatus(
  lineStatuses: readonly (OrderStatus | null)[]
): OrderStatus | null {
  const outstanding = lineStatuses.filter((s): s is OrderStatus => s !== null);
  if (outstanding.length === 0) return null;

  const live = outstanding.filter((s) => s !== 'cancelled');
  if (live.length === 0) return 'cancelled';

  return live.reduce((least, s) => (rank(s) < rank(least) ? s : least));
}
