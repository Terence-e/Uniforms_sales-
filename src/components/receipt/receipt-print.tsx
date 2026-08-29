'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Printer, ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { formatDate, formatDateTime, formatMoney, SCHOOL } from '@/lib/format';
import type { OrderStatus, PaymentMethod } from '@/types/database.types';

export type ReceiptData = {
  /**
   * 'order' prints the same sheet stamped COMMANDE / ORDER and adds the
   * expected-ready and measurements rows. The print geometry is shared on
   * purpose -- one @page rule to check against the real printer, not two.
   */
  kind?: 'sale' | 'order';
  /** Carries `order_no` when kind is 'order'; the label switches with it. */
  receipt_no: string;
  /** Orders only. */
  expected_ready_date?: string | null;
  measurements?: string | null;
  /**
   * The order's derived status, so a REPRINT tells the truth. The stamp used to
   * be hard-coded "not yet collected", which was safe only while nothing could
   * reach 'collected'. Now that a line can, a reprinted sheet must not keep
   * insisting the garment is still in the shop.
   */
  order_status?: OrderStatus | null;
  sold_at: string;
  customer_name: string;
  student_name: string | null;
  class_level: string | null;
  payment_method: PaymentMethod;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  signature_url: string | null;
  seller_name: string;
  items: {
    id: string;
    description: string;
    size: string | null;
    unit_price: number;
    quantity: number;
    line_total: number;
  }[];
};

/**
 * Print layout.
 *
 * The page geometry lives in the `@page` rule inside the inline <style> block
 * below rather than in Tailwind classes -- `@page` has no utility equivalent,
 * and keeping the whole print sheet in one place makes it far easier to check
 * against a real printer. Everything chrome-like carries `print:hidden`.
 */
export function ReceiptPrint({ receipt }: { receipt: ReceiptData }) {
  const t = useTranslations('Receipt');
  const tPayment = useTranslations('Sales.payment');
  const locale = useLocale();
  const isOrder = receipt.kind === 'order';

  return (
    <>
      <style>{`
        @page {
          size: A5 portrait;
          margin: 12mm;
        }
        @media print {
          html, body { background: #fff !important; }
          .receipt-sheet {
            box-shadow: none !important;
            border: 0 !important;
            padding: 0 !important;
            max-width: none !important;
          }
          /* Never split a line item across two sheets. */
          .receipt-sheet tr { break-inside: avoid; }
          .receipt-sheet thead { display: table-header-group; }
        }
      `}</style>

      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={isOrder ? '/orders' : '/sales'}>
            <ArrowLeft className="size-4" />
            {isOrder ? t('backToOrders') : t('back')}
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" />
          {t('print')}
        </Button>
      </div>

      <article className="receipt-sheet mx-auto max-w-xl rounded-lg border bg-white p-8 text-black shadow-sm">
        <header className="border-b pb-4 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">
            {SCHOOL.name}
          </h1>
          {SCHOOL.address ? (
            <p className="text-xs text-neutral-600">{SCHOOL.address}</p>
          ) : null}
          {SCHOOL.phone ? (
            <p className="text-xs text-neutral-600">{SCHOOL.phone}</p>
          ) : null}
          {isOrder ? (
            /* Deliberately bilingual whatever the UI locale: this line is the
               one thing that must not be misread at the counter, and the parent
               reading it may not share the language the seller was working in.
               A-FR-9.3. */
            <div className="mt-2 border-2 border-black px-3 py-2">
              <p className="text-base font-bold uppercase tracking-wide">
                {receipt.order_status === 'cancelled'
                  ? 'Commande annulée / Order cancelled'
                  : 'Commande / Order'}
              </p>
              <p className="text-[0.7rem] font-semibold uppercase">
                {/* null means no line was ever outstanding -- every item went
                    home at the counter -- so it reads as collected, not as
                    something still owed. */}
                {receipt.order_status === 'collected' || receipt.order_status == null
                  ? 'Retiré · Collected'
                  : receipt.order_status === 'cancelled'
                    ? 'Remboursée · Refunded'
                    : 'Pas encore retiré · Not yet collected'}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold uppercase">{t('title')}</p>
          )}
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-b py-4 text-xs">
          <Meta
            label={isOrder ? t('orderNo') : t('receiptNo')}
            value={receipt.receipt_no}
            mono
          />
          <Meta label={t('date')} value={formatDateTime(receipt.sold_at, locale)} />
          {isOrder && receipt.expected_ready_date ? (
            <Meta
              label={t('expectedReady')}
              value={formatDate(receipt.expected_ready_date, locale)}
            />
          ) : null}
          <Meta label={t('customer')} value={receipt.customer_name} />
          {receipt.student_name ? (
            <Meta label={t('student')} value={receipt.student_name} />
          ) : null}
          {receipt.class_level ? (
            <Meta label={t('class')} value={receipt.class_level} />
          ) : null}
          <Meta label={t('servedBy')} value={receipt.seller_name} />
        </dl>

        <table className="w-full border-collapse py-4 text-xs">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 font-semibold">{t('description')}</th>
              <th className="py-2 text-right font-semibold">{t('quantity')}</th>
              <th className="py-2 text-right font-semibold">{t('unitPrice')}</th>
              <th className="py-2 text-right font-semibold">{t('amount')}</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((item) => (
              <tr key={item.id} className="border-b border-dashed">
                <td className="py-2">
                  {item.description}
                  {item.size ? (
                    <span className="text-neutral-500"> ({item.size})</span>
                  ) : null}
                </td>
                <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatMoney(item.unit_price, locale)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatMoney(item.line_total, locale)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-3 text-right text-neutral-600">
                {t('subtotal')}
              </td>
              <td className="pt-3 text-right tabular-nums">
                {formatMoney(receipt.subtotal, locale)}
              </td>
            </tr>
            {receipt.discount > 0 ? (
              <tr>
                <td colSpan={3} className="text-right text-neutral-600">
                  {t('discount')}
                </td>
                <td className="text-right tabular-nums">
                  − {formatMoney(receipt.discount, locale)}
                </td>
              </tr>
            ) : null}
            <tr className="border-t">
              <td colSpan={3} className="pt-2 text-right text-sm font-bold">
                {t('total')}
              </td>
              <td className="pt-2 text-right text-sm font-bold tabular-nums">
                {formatMoney(receipt.total, locale)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-3 text-xs">
          <span className="text-neutral-600">{t('paymentMethod')}: </span>
          {tPayment(receipt.payment_method)}
        </p>

        {isOrder && receipt.measurements ? (
          <p className="mt-2 text-xs">
            <span className="text-neutral-600">{t('measurements')}: </span>
            {receipt.measurements}
          </p>
        ) : null}

        {receipt.notes ? (
          <p className="mt-2 text-xs text-neutral-600">{receipt.notes}</p>
        ) : null}

        <div className="mt-8 flex items-end justify-between gap-8">
          <div className="flex-1">
            <p className="mb-1 text-[0.65rem] uppercase text-neutral-500">
              {t('signature')}
            </p>
            {receipt.signature_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL, not an optimisable asset
              <img
                src={receipt.signature_url}
                alt={t('signature')}
                className="h-16 object-contain"
              />
            ) : (
              <div className="h-16 border-b border-neutral-400" />
            )}
          </div>
        </div>

        <footer className="mt-6 border-t pt-3 text-center text-[0.65rem] text-neutral-500">
          {isOrder ? t('orderFooter') : t('footer')}
        </footer>
      </article>
    </>
  );
}

function Meta({
  label,
  value,
  mono
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="text-neutral-600">{label}:</dt>
      <dd className={mono ? 'font-mono font-semibold' : 'font-medium'}>{value}</dd>
    </div>
  );
}
