import { z } from 'zod';
import {
  computeSubtotal,
  EMPTY_SALE_ITEM,
  money,
  PAYMENT_METHODS,
  saleItemSchema
} from './sale-schema';

/**
 * An order is a sale that has not been handed over yet, so it validates
 * identically -- same customer block, same money rules, same line items -- plus
 * the three fields a walk-in sale has no use for: when the garment is expected,
 * the tailor's measurements, and whether each line is going home today.
 *
 * The line-item shape is the sale's, extended: reusing it means a fix to how a
 * line validates cannot apply to one form and miss the other.
 *
 * Totals are NOT defined here. `computeTotals()` in sale-schema.ts stays the one
 * place money is derived, for orders and sales alike.
 */

export const orderItemSchema = saleItemSchema.extend({
  /**
   * True when the parent takes this line away at the counter. Such a line never
   * enters the status workflow -- the server stores its status as NULL, which
   * the database treats as "no workflow" (A-FR-9.5).
   *
   * Deliberately z.boolean() and not z.coerce.boolean(): coercion turns the
   * string "false" into true, and this flag decides whether a garment is
   * tracked at all.
   */
  handedOver: z.boolean().default(false)
});

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

export type OrderItemInput = z.input<typeof orderItemSchema>;
export type OrderInput = z.input<typeof orderSchema>;
export type OrderParsed = z.output<typeof orderSchema>;

export const EMPTY_ORDER_ITEM: OrderItemInput = {
  ...EMPTY_SALE_ITEM,
  handedOver: false
};

// ------------------------------------------------------- status transitions

/**
 * A reason is mandatory whenever the workflow is not moving forwards -- a step
 * back or a cancellation. `min(3)` rather than `min(1)` because "x" is not a
 * reason, and this text is what the audit log will be read back for months
 * later. The database enforces presence independently; this is the message the
 * seller actually sees.
 */
const reason = z
  .string({ message: 'reasonRequired' })
  .trim()
  .min(3, { message: 'reasonRequired' })
  .max(500);

export const advanceLineSchema = z.object({
  lineId: z.uuid({ message: 'required' })
});

export const revertLineSchema = z.object({
  lineId: z.uuid({ message: 'required' }),
  reason
});

export const cancelLineSchema = z.object({
  lineId: z.uuid({ message: 'required' }),
  reason,
  /** May differ from how the parent originally paid (A-FR-9.24). */
  refundMethod: z.enum(PAYMENT_METHODS, { message: 'required' })
});

export type AdvanceLineInput = z.input<typeof advanceLineSchema>;
export type RevertLineInput = z.input<typeof revertLineSchema>;
export type CancelLineInput = z.input<typeof cancelLineSchema>;

// ------------------------------------------------------------- collection

/**
 * Recording a collection (A-FR-9.7). At least one line, a named collector, and
 * the member of staff who handed the garments over.
 *
 * The collector is free text and required: it is the only record of who
 * actually walked out with the uniform, and it is regularly not the parent who
 * placed the order.
 */
export const collectionSchema = z.object({
  orderId: z.uuid({ message: 'required' }),
  lineIds: z.array(z.uuid({ message: 'required' })).min(1, { message: 'selectLines' }),
  collectorName: z
    .string({ message: 'required' })
    .trim()
    .min(2, { message: 'required' })
    .max(120),
  handedOverBy: z.uuid({ message: 'required' })
});

export type CollectionInput = z.input<typeof collectionSchema>;
