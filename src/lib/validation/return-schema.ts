import { z } from 'zod';
import { PAYMENT_METHODS } from './sale-schema';

/**
 * Returns and exchanges (A-FR-8.1 to A-FR-8.6).
 *
 * One schema for both, because a return is an exchange with nothing going the
 * other way. What differs is direction, and direction is a field.
 *
 * Note what is NOT here: prices, refund amount, collected amount. The server
 * reads every price -- what comes back is priced from the original sale line,
 * what goes out from the catalogue -- and derives the difference itself. A
 * client that could name its own refund amount could refund more than the
 * garment ever cost, so the form is not permitted to send one.
 */

export const RETURN_KINDS = ['return', 'exchange'] as const;
export type ReturnKind = (typeof RETURN_KINDS)[number];

/**
 * Declared by the seller, never assessed by the system (A-FR-8.9). Recorded
 * exactly the way a payment method is: as what someone said.
 */
export const GARMENT_CONDITIONS = ['unworn', 'worn'] as const;
export type GarmentCondition = (typeof GARMENT_CONDITIONS)[number];

const quantity = z.coerce
  .number({ message: 'positive' })
  .int({ message: 'positive' })
  .positive({ message: 'positive' })
  .max(9999);

/** A garment coming back. Identified by the sale line it was bought on. */
export const returnedLineSchema = z.object({
  saleItemId: z.uuid({ message: 'required' }),
  quantity
});

/** A garment going out in exchange. A fresh catalogue pick, not an old line. */
export const outgoingLineSchema = z.object({
  productId: z.uuid({ message: 'selectProduct' }),
  quantity
});

export const returnSchema = z
  .object({
    saleId: z.uuid({ message: 'required' }),
    kind: z.enum(RETURN_KINDS, { message: 'required' }),
    /**
     * Mandatory (A-FR-8.3), and `min(3)` rather than `min(1)` because "x" is
     * not a reason. This text is what the out-of-policy report gets read back
     * for months later. The database enforces presence independently; this is
     * the message the seller actually sees.
     */
    reason: z
      .string({ message: 'reasonRequired' })
      .trim()
      .min(3, { message: 'reasonRequired' })
      .max(500),
    condition: z.enum(GARMENT_CONDITIONS, { message: 'required' }),
    returnedItems: z.array(returnedLineSchema).min(1, { message: 'minItems' }).max(50),
    outgoingItems: z.array(outgoingLineSchema).max(50).default([]),
    /**
     * Both optional here and both checked by the server once it knows which way
     * the money moved. The form cannot know: it does not price the lines, so it
     * cannot tell a refund from a collection until the server answers.
     *
     * A refund method is deliberately free to differ from how the sale was paid
     * (A-FR-8.5) -- a MoMo sale may be refunded in cash.
     */
    refundMethod: z.enum(PAYMENT_METHODS).nullable().default(null),
    collectedMethod: z.enum(PAYMENT_METHODS).nullable().default(null),
    receivedBy: z.uuid().nullable().default(null),
    notes: z.string().trim().max(500).nullable().default(null)
  })
  .superRefine((value, ctx) => {
    // An exchange with nothing going out is a return, and a return with
    // something going out is an exchange. Naming it wrongly would put the
    // transaction in the wrong half of every report that follows.
    if (value.kind === 'exchange' && value.outgoingItems.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['outgoingItems'],
        message: 'exchangeNeedsOutgoing'
      });
    }
    if (value.kind === 'return' && value.outgoingItems.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['outgoingItems'],
        message: 'returnTakesNothingOut'
      });
    }
  });

export type ReturnInput = z.input<typeof returnSchema>;
export type ReturnParsed = z.output<typeof returnSchema>;

export const EMPTY_OUTGOING_LINE: z.input<typeof outgoingLineSchema> = {
  productId: '',
  quantity: 1
};
