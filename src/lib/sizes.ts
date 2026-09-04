import type { AppSizeConfig, SizeMode } from '@/types/database.types';

/**
 * The size set, decoupled from the database row shape so the UI and the pickers
 * never touch snake_case columns directly. One place expands the configured set
 * into the ordered list of labels every size box, product-stock row and report
 * reads from -- letters and metrics can then never disagree about what the set is.
 */
export type SizeConfig = {
  mode: SizeMode;
  /** Ordered labels for `letters` mode (order is display order, not sorted). */
  letters: string[];
  metricMin: number;
  metricMax: number;
  metricStep: number;
};

/** A sane ceiling so a fat-fingered range (min 0, max 9999, step 1) cannot
 *  render thousands of boxes or blow up a product page. */
const MAX_SIZES = 200;

export function toSizeConfig(row: AppSizeConfig): SizeConfig {
  return {
    mode: row.mode,
    letters: row.letters ?? [],
    metricMin: row.metric_min,
    metricMax: row.metric_max,
    metricStep: row.metric_step
  };
}

/**
 * The predefined sizes as an ordered list of labels. `letters` mode returns the
 * list as entered; `metrics` walks min -> max by step. A custom size typed at
 * the counter is never in here -- this is only the set shown as boxes.
 */
export function expandSizes(config: SizeConfig): string[] {
  if (config.mode === 'letters') {
    return config.letters.map((s) => s.trim()).filter(Boolean);
  }
  const step = Math.max(1, Math.floor(config.metricStep || 1));
  const out: string[] = [];
  for (let n = config.metricMin; n <= config.metricMax && out.length < MAX_SIZES; n += step) {
    out.push(String(n));
  }
  return out;
}
