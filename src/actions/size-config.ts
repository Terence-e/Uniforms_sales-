'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { expandSizes, toSizeConfig, type SizeConfig } from '@/lib/sizes';
import type { SizeMode } from '@/types/database.types';

/**
 * The size set (A-FR-4.2). Read by everyone (the boxes render for the seller);
 * written by the Super Admin only, enforced by RLS. The seed is numeric 20-46 by
 * 2, the school's working assumption.
 */

export type SizeConfigResult = {
  config: SizeConfig;
  /** The expanded, ordered labels -- what the pickers show as boxes. */
  sizes: string[];
};

/** The single configuration row, plus the expanded set. Falls back to the seed
 *  default if the row is somehow missing rather than rendering no sizes. */
export async function getSizeConfig(): Promise<SizeConfigResult> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('app_size_config')
    .select('id, mode, letters, metric_min, metric_max, metric_step, updated_at, updated_by')
    .eq('id', true)
    .maybeSingle();

  const config: SizeConfig = data
    ? toSizeConfig(data)
    : { mode: 'metrics', letters: [], metricMin: 20, metricMax: 46, metricStep: 2 };

  return { config, sizes: expandSizes(config) };
}

export type UpdateSizeConfigInput = {
  mode: SizeMode;
  letters: string[];
  metricMin: number;
  metricMax: number;
  metricStep: number;
};

export type UpdateSizeConfigResult = { ok: true } | { ok: false; error: string };

/**
 * Replaces the size set. Validated here so a bad set never reaches the counter,
 * and again by the table's own constraints; the RLS policy is what actually
 * enforces "Super Admin only". Audited with the whole before/after, because
 * changing the set changes what is sellable and how stock is bucketed.
 */
export async function updateSizeConfig(
  input: UpdateSizeConfigInput
): Promise<UpdateSizeConfigResult> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  if (input.mode === 'letters') {
    const cleaned = Array.from(
      new Set(input.letters.map((s) => s.trim()).filter(Boolean))
    );
    if (cleaned.length === 0) return { ok: false, error: 'lettersEmpty' };
    if (cleaned.length > 200) return { ok: false, error: 'lettersTooMany' };
    input = { ...input, letters: cleaned };
  } else {
    const { metricMin, metricMax, metricStep } = input;
    if (![metricMin, metricMax, metricStep].every(Number.isInteger)) {
      return { ok: false, error: 'metricInvalid' };
    }
    if (metricMin < 0 || metricMax < metricMin) return { ok: false, error: 'metricRange' };
    if (metricStep < 1) return { ok: false, error: 'metricStep' };
    if ((metricMax - metricMin) / metricStep > 200) return { ok: false, error: 'metricTooMany' };
  }

  const { data: before } = await supabase
    .from('app_size_config')
    .select('mode, letters, metric_min, metric_max, metric_step')
    .eq('id', true)
    .maybeSingle();

  const { error } = await supabase
    .from('app_size_config')
    .update({
      mode: input.mode,
      letters: input.letters,
      metric_min: input.metricMin,
      metric_max: input.metricMax,
      metric_step: input.metricStep,
      updated_by: user.id
    })
    .eq('id', true);

  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: user.id,
    action: 'size_config_changed',
    targetTable: 'app_size_config',
    targetId: 'size_config',
    previousValue: before ?? null,
    newValue: {
      mode: input.mode,
      letters: input.letters,
      metric_min: input.metricMin,
      metric_max: input.metricMax,
      metric_step: input.metricStep
    }
  });

  // The set feeds the size boxes on every selling screen, and the product stock
  // view. Revalidate the places that render them.
  revalidatePath('/settings', 'page');
  revalidatePath('/sales', 'page');
  revalidatePath('/orders', 'page');
  revalidatePath('/stock', 'page');
  return { ok: true };
}
