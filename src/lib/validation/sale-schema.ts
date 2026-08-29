import { z } from 'zod';

/**
 * Shared by the client form and the Server Action. The server re-parses
 * everything the client sent -- client-side validation is a convenience, not a
 * guarantee.
 *
 * Error messages are message-catalogue keys under `Validation.*`, resolved by
 * `useValidationMessage()` in the form. See messages/en.json.
 */

export const PAYMENT_METHODS = ['cash', 'mobile_money', 'bank_transfer'] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

/** Money is stored as numeric(12,2); round before comparing or persisting. */
export function toMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Exported so order-schema.ts validates money exactly as the sale form does. */
export const money = z.coerce
  .number({ message: 'positive' })
  .nonnegative({ message: 'nonNegative' })
  .finite({ message: 'nonNegative' })
  .transform(toMoney);

export const saleItemSchema = z.object({
  productId: z.uuid({ message: 'required' }).nullable().default(null),
  description: z.string({ message: 'required' }).trim().min(1, { message: 'required' }).max(200),
  size: z.string().trim().max(20).nullable().default(null),
  unitPrice: money,
  quantity: z.coerce
    .number({ message: 'positive' })
    .int({ message: 'positive' })
    .positive({ message: 'positive' })
    .max(9999)
});

export const saleSchema = z
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
    items: z.array(saleItemSchema).min(1, { message: 'minItems' }).max(50),
    discount: money.default(0),
    notes: z.string().trim().max(500).nullable().default(null),
    /** Phase 2: data URL captured by the signature pad. */
    signature: z.string().nullable().default(null)
  })
  .superRefine((sale, ctx) => {
    const subtotal = computeSubtotal(sale.items);
    if (sale.discount > subtotal) {
      ctx.addIssue({
        code: 'custom',
        path: ['discount'],
        message: 'discountTooLarge'
      });
    }
  });

export type SaleItemInput = z.input<typeof saleItemSchema>;
export type SaleInput = z.input<typeof saleSchema>;
export type SaleParsed = z.output<typeof saleSchema>;

// ------------------------------------------------------------------ totals

type LineLike = { unitPrice: number; quantity: number };

export function computeLineTotal(line: LineLike): number {
  return toMoney(line.unitPrice * line.quantity);
}

export function computeSubtotal(items: readonly LineLike[]): number {
  return toMoney(items.reduce((sum, item) => sum + computeLineTotal(item), 0));
}

/**
 * The single place totals are derived. The client uses it to render a running
 * total and the Server Action uses it to compute what actually gets written --
 * the browser's arithmetic is never persisted.
 */
export function computeTotals(items: readonly LineLike[], discount: number) {
  const subtotal = computeSubtotal(items);
  const appliedDiscount = toMoney(Math.min(Math.max(discount, 0), subtotal));
  return {
    subtotal,
    discount: appliedDiscount,
    total: toMoney(subtotal - appliedDiscount)
  };
}

// ------------------------------------------------------------------ empty row

export const EMPTY_SALE_ITEM: SaleItemInput = {
  productId: null,
  description: '',
  size: null,
  unitPrice: 0,
  quantity: 1
};
