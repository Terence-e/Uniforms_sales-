import { z } from 'zod';

/** A product per A-FR-4.1: garment + size + whole-FCFA price + optional low-stock
 * threshold. Quantity is derived (stock_levels), not entered here. */
export const productSchema = z.object({
  name_en: z.string().trim().min(1, { message: 'required' }).max(120),
  name_fr: z.string().trim().max(120).optional().default(''),
  size: z.string().trim().min(1, { message: 'required' }).max(40),
  category: z.string().trim().max(40).default('uniform'),
  // FCFA is a whole number (A-FR-4.1).
  unit_price: z.coerce.number().int({ message: 'wholeNumber' }).min(0, { message: 'nonNegative' }),
  reorder_level: z.coerce
    .number()
    .int({ message: 'wholeNumber' })
    .min(0, { message: 'nonNegative' })
    .optional()
    .default(0)
});

export type ProductInput = z.input<typeof productSchema>;
