import { z } from 'zod';

/**
 * Production entry (A-FR-5.2, A-FR-5.3).
 *
 * The shop makes its uniforms, so a submission is a batch: several products and
 * quantities entered together, because "5 shirts size 8 and 3 size 10" is one
 * act at the machine, not two trips through a form.
 *
 * Mirrors record_production_batch() in
 * supabase/migrations/20260101001400_record_production_batch.sql. The database
 * is the authority -- it re-checks all of this and rejects anything that gets
 * past the form -- but the seller should hear about a bad quantity before
 * submitting, not after.
 */

export const productionLineSchema = z.object({
  productId: z.uuid({ message: 'required' }),
  /**
   * Production only ever adds. An over-count is corrected with a compensating
   * 'adjustment' movement rather than a negative production row, so the ledger
   * reads as what happened rather than as arithmetic.
   */
  quantity: z.coerce
    .number({ message: 'positive' })
    .int({ message: 'wholeNumber' })
    .positive({ message: 'positive' })
    .max(10000)
});

export const productionBatchSchema = z.object({
  lines: z.array(productionLineSchema).min(1, { message: 'minItems' }).max(50),
  /**
   * The day the garments were MADE, which is often not the day they are typed
   * in -- a Saturday run entered on Monday. Defaults to today in the form; the
   * database refuses a future date, since that is nearly always a mistyped year
   * and it quietly corrupts every production report after it.
   */
  occurredOn: z
    .string({ message: 'required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'invalidDate' }),
  /** Free text: the people sewing are not users of this system. */
  tailorName: z.string().trim().max(120).nullable().default(null),
  note: z.string().trim().max(500).nullable().default(null)
});

export type ProductionLineInput = z.input<typeof productionLineSchema>;
export type ProductionBatchInput = z.input<typeof productionBatchSchema>;

export const EMPTY_PRODUCTION_LINE: ProductionLineInput = {
  productId: '',
  quantity: 1
};

/** Total garments in the batch -- shown live so the seller can sanity-check it. */
export function totalUnits(lines: readonly { quantity: unknown }[]): number {
  return lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
}
