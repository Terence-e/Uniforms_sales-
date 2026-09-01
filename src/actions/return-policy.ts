'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import type { GarmentCondition, ReturnKind } from '@/types/database.types';

/**
 * The return policy windows (A-FR-8.7 to A-FR-8.11).
 *
 * The verdict itself is not computed here. `return_policy_verdict()` in the
 * database is the single implementation, called both by the banner the seller
 * reads before entering anything and by `record_return()` when it stamps the
 * row. Two implementations of one rule are two chances for the warning and the
 * record to disagree about what happened.
 */

export type PolicyRow = {
  kind: ReturnKind;
  condition: GarmentCondition;
  /** null = never within policy, which is not the same as a zero-day window. */
  window_days: number | null;
};

export type Verdict = {
  elapsedDays: number;
  windowDays: number | null;
  withinPolicy: boolean;
};

/** All four windows, for the settings screen and the verdict table. */
export async function listReturnPolicy(): Promise<PolicyRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('return_policy')
    .select('kind, condition, window_days')
    .order('kind')
    .order('condition');
  return (data ?? []) as PolicyRow[];
}

/**
 * The verdict for one sale under one combination.
 *
 * A-FR-8.10 wants it on screen before anything is entered, so the return page
 * asks for all four up front (see `verdictsForSale`) rather than waiting for
 * the seller to pick a kind and a condition.
 */
export async function getVerdict(
  soldAt: string,
  kind: ReturnKind,
  condition: GarmentCondition
): Promise<Verdict | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .rpc('return_policy_verdict', {
      p_sold_at: soldAt,
      p_kind: kind,
      p_condition: condition
    })
    .single();

  if (!data) return null;
  const row = data as {
    elapsed_days: number;
    window_days: number | null;
    within_policy: boolean;
  };
  return {
    elapsedDays: Number(row.elapsed_days),
    windowDays: row.window_days === null ? null : Number(row.window_days),
    withinPolicy: row.within_policy
  };
}

/**
 * Every combination's verdict for one sale, keyed `${kind}:${condition}`.
 *
 * Fetched in one go on the server so the form can answer instantly as the
 * seller flips between Exchange and Return, or Unworn and Worn. A round trip
 * per toggle would make the banner lag behind the control that changed it --
 * and a verdict that arrives after the seller has moved on is not a verdict
 * shown "before anything is entered".
 *
 * Four cheap calls rather than one clever query: the elapsed days are the same
 * for all four, but the window and the verdict are not, and the rule for
 * combining them lives in the database function rather than here.
 */
export async function verdictsForSale(soldAt: string): Promise<Record<string, Verdict>> {
  const kinds: ReturnKind[] = ['exchange', 'return'];
  const conditions: GarmentCondition[] = ['unworn', 'worn'];

  const pairs = kinds.flatMap((kind) => conditions.map((condition) => ({ kind, condition })));
  const results = await Promise.all(
    pairs.map(async ({ kind, condition }) => {
      const verdict = await getVerdict(soldAt, kind, condition);
      return [`${kind}:${condition}`, verdict] as const;
    })
  );

  const map: Record<string, Verdict> = {};
  for (const [key, verdict] of results) {
    if (verdict) map[key] = verdict;
  }
  return map;
}

export type UpdatePolicyResult = { ok: true } | { ok: false; error: string };

/**
 * Changes one window (A-FR-8.8).
 *
 * Super Admin only, enforced by RLS -- a seller who could widen a window to fit
 * the return they are currently recording would make the override, and the
 * whole out-of-policy report, meaningless.
 *
 * Audited with both the old and the new value. A policy change silently
 * reclassifies nothing already recorded -- every return stores the verdict it
 * was given -- but it does change every judgement from here on, and that is
 * worth being able to date.
 */
export async function updateReturnPolicy(input: {
  kind: ReturnKind;
  condition: GarmentCondition;
  /** null means "not permitted". */
  windowDays: number | null;
}): Promise<UpdatePolicyResult> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  if (input.windowDays !== null) {
    if (!Number.isInteger(input.windowDays) || input.windowDays < 0) {
      return { ok: false, error: 'invalidWindow' };
    }
    // Ten years. Not a business rule -- a typo guard. Someone entering a date
    // instead of a day count would otherwise set a 20260101-day window and
    // quietly disable the policy for ever.
    if (input.windowDays > 3650) return { ok: false, error: 'windowTooLong' };
  }

  const { data: before } = await supabase
    .from('return_policy')
    .select('window_days')
    .eq('kind', input.kind)
    .eq('condition', input.condition)
    .single();

  const { error } = await supabase
    .from('return_policy')
    .update({ window_days: input.windowDays, updated_by: user.id })
    .eq('kind', input.kind)
    .eq('condition', input.condition);

  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: user.id,
    action: 'return_policy_changed',
    entity: `${input.kind}:${input.condition}`,
    targetTable: 'return_policy',
    targetId: `${input.kind}:${input.condition}`,
    previousValue: { window_days: before?.window_days ?? null },
    newValue: { window_days: input.windowDays }
  });

  revalidatePath('/settings', 'page');
  revalidatePath('/returns', 'page');
  return { ok: true };
}
