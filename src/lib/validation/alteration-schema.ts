import { z } from 'zod';
import { money, PAYMENT_METHODS } from './sale-schema';

/**
 * Alterations (A-FR-9.12 .. A-FR-9.15).
 *
 * Mirrors alterations table in
 * supabase/migrations/20260101001600_alterations.sql and the rules in
 * 20260101001700_alteration_transitions.sql. The database enforces all of this
 * independently; these are the messages the seller actually sees.
 *
 * There is no product reference anywhere in here, deliberately. The garment
 * belongs to the parent -- it is one specific object, possibly bought years ago
 * or somewhere else entirely -- so it is described, not selected, and no step
 * of this workflow touches stock.
 */

/** `<input type="date">` yields '' when cleared, never null. */
const expectedReadyDate = z
  .preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'invalidDate' })
      .nullable()
  )
  .default(null);

export const alterationSchema = z
  .object({
    /** The parent. Required: they are who the school answers to for the garment. */
    customerName: z
      .string({ message: 'required' })
      .trim()
      .min(2, { message: 'required' })
      .max(120),
    studentName: z.string().trim().max(120).nullable().default(null),
    classLevel: z.string().trim().max(40).nullable().default(null),
    phone: z.string().trim().max(30).nullable().default(null),

    garment: z
      .string({ message: 'required' })
      .trim()
      .min(2, { message: 'required' })
      .max(200),
    size: z.string().trim().max(20).nullable().default(null),
    /**
     * Mandatory (A-FR-9.12). A garment held with no record of what was asked
     * for is a dispute waiting to happen, so this is the one free-text field
     * the form refuses to submit without.
     */
    workRequired: z
      .string({ message: 'workRequired' })
      .trim()
      .min(3, { message: 'workRequired' })
      .max(1000),

    expectedReadyDate,
    /** Zero when the school does the work for free, which happens. */
    charge: money.default(0),
    /**
     * Payment may be taken now or when the garment goes back -- the shop does
     * both -- so the form offers it at intake without requiring it, and the
     * detail screen can record it later.
     */
    paidNow: z.boolean().default(false),
    paymentMethod: z.enum(PAYMENT_METHODS).nullable().default(null),
    notes: z.string().trim().max(500).nullable().default(null)
  })
  .superRefine((alteration, ctx) => {
    if (alteration.paidNow && alteration.charge <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['paidNow'],
        message: 'nothingToPay'
      });
    }
    if (alteration.paidNow && !alteration.paymentMethod) {
      ctx.addIssue({
        code: 'custom',
        path: ['paymentMethod'],
        message: 'required'
      });
    }
  });

export type AlterationInput = z.input<typeof alterationSchema>;

// ------------------------------------------------------ status transitions

/** Same rule as orders: "x" is not a reason worth reading back months later. */
const reason = z
  .string({ message: 'reasonRequired' })
  .trim()
  .min(3, { message: 'reasonRequired' })
  .max(500);

export const advanceAlterationSchema = z.object({
  alterationId: z.uuid({ message: 'required' })
});

export const revertAlterationSchema = z.object({
  alterationId: z.uuid({ message: 'required' }),
  reason
});

export const cancelAlterationSchema = z.object({
  alterationId: z.uuid({ message: 'required' }),
  reason
});

/** Recording payment separately, for the charge-on-return case. */
export const payAlterationSchema = z.object({
  alterationId: z.uuid({ message: 'required' }),
  paymentMethod: z.enum(PAYMENT_METHODS, { message: 'required' })
});

export type AdvanceAlterationInput = z.input<typeof advanceAlterationSchema>;
export type RevertAlterationInput = z.input<typeof revertAlterationSchema>;
export type CancelAlterationInput = z.input<typeof cancelAlterationSchema>;
export type PayAlterationInput = z.input<typeof payAlterationSchema>;
