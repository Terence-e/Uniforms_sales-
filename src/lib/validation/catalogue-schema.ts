import { z } from 'zod';

/** A product is now a garment only: name + whole-FCFA price + optional low-stock
 * threshold. Size left the product (A-FR-4.2) -- it is chosen at the point of
 * sale/order/exchange from the configured set, and stock is tracked per size.
 * Quantity is derived (stock_levels), not entered here. */
export const productSchema = z.object({
  name_en: z.string().trim().min(1, { message: 'required' }).max(120),
  name_fr: z.string().trim().max(120).optional().default(''),
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
