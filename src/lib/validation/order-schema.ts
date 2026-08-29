import { z } from 'zod';
import {
  computeSubtotal,
  EMPTY_SALE_ITEM,
  money,
  PAYMENT_METHODS,
  saleItemSchema,
  type SaleItemInput
} from './sale-schema';

/**
 * An order is a sale that has not been handed over yet, so it validates
 * identically -- same customer block, same money rules, same line items -- plus
 * the three fields a walk-in sale has no use for: when the garment is expected,
 * the tailor's measurements, and (implicitly) a status, which the server sets
 * rather than the client.
 *
 * The line-item shape is literally the sale's: reusing it means a fix to how a
 * line validates cannot apply to one form and miss the other.
 *
 * Totals are NOT defined here. `computeTotals()` in sale-schema.ts stays the one
 * place money is derived, for orders and sales alike.
 */

export const orderItemSchema = saleItemSchema;

/**
 * `<input type="date">` yields '' when cleared, never null, and the column is
 * nullable -- so normalise before the string check rather than after.
 */
const expectedReadyDate = z
  .preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'invalidDate' })
      .nullable()
  )
  .default(null);

export const orderSchema = z
  .object({
    customerName: z
      .string({ message: 'required' })
      .trim()
      .min(2, { message: 'required' })
      .max(120),
    studentName: z.string().trim().max(120).nullable().default(null),
    classLevel: z.string().trim().max(40).nullable().default(null),
    phone: z.string().trim().max(30).nullable().default(null),
    paymentMethod: z.enum(PAYMENT_METHODS, { message: 'required' }).default('cash'),
    items: z.array(orderItemSchema).min(1, { message: 'minItems' }).max(50),
    discount: money.default(0),
    expectedReadyDate,
    /** Free text for whoever makes the garment: chest, waist, sleeve, hem. */
    measurements: z.string().trim().max(1000).nullable().default(null),
    notes: z.string().trim().max(500).nullable().default(null)
  })
  .superRefine((order, ctx) => {
    const subtotal = computeSubtotal(order.items);
    if (order.discount > subtotal) {
      ctx.addIssue({
        code: 'custom',
        path: ['discount'],
        message: 'discountTooLarge'
      });
    }
  });

export type OrderItemInput = SaleItemInput;
export type OrderInput = z.input<typeof orderSchema>;
export type OrderParsed = z.output<typeof orderSchema>;

export const EMPTY_ORDER_ITEM: OrderItemInput = EMPTY_SALE_ITEM;
