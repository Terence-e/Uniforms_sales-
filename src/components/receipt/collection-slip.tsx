'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Printer, ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatMoney, SCHOOL } from '@/lib/format';

export type CollectionSlipData = {
  col_no: string;
  collected_at: string;
  collector_name: string;
  handed_over_by: string;
  order_id: string;
  order_no: string;
  ordered_at: string;
  customer_name: string;
  student_name: string | null;
  class_level: string | null;
  items: {
    id: string;
    description: string;
    size: string | null;
    quantity: number;
    line_total: number;
  }[];
};

/**
 * The collection slip (A-FR-9.8).
 *
 * A separate sheet from the order receipt rather than another variant of it:
 * this document proves goods were handed over, where the receipt proves money
 * was taken. They carry different fields and get signed by different people.
 * The @page geometry is deliberately identical so both print on the same A5
 * stock without re-checking the printer.
 *
 * Both references are shown together and equally weighted -- that pairing is
 * the whole point of the slip. A parent holding it can be traced back to the
 * order, and an order can be traced forward to every slip issued against it.
 */
export function CollectionSlip({ slip }: { slip: CollectionSlipData }) {
  const t = useTranslations('Collection');
  const locale = useLocale();

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
          .receipt-sheet tr { break-inside: avoid; }
          .receipt-sheet thead { display: table-header-group; }
        }
      `}</style>

      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/orders/${slip.order_id}`}>
            <ArrowLeft className="size-4" />
            {t('backToOrder')}
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" />
          {t('print')}
        </Button>
      </div>

      <article className="receipt-sheet mx-auto max-w-xl rounded-lg border bg-white p-8 text-black shadow-sm">
        <header className="border-b pb-4 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">{SCHOOL.name}</h1>
          {SCHOOL.address ? (
            <p className="text-xs text-neutral-600">{SCHOOL.address}</p>
          ) : null}
          {SCHOOL.phone ? <p className="text-xs text-neutral-600">{SCHOOL.phone}</p> : null}

          {/* Bilingual whatever the UI locale: the person holding this slip may
              not share the language the seller was working in (A-FR-9.8). */}
          <div className="mt-2 border-2 border-black px-3 py-2">
            <p className="text-base font-bold uppercase tracking-wide">
              Retiré / Collected
            </p>
          </div>
        </header>

        {/* The two references, side by side and equally weighted. */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-b py-4 text-xs">
          <Meta label={t('colNo')} value={slip.col_no} mono />
          <Meta label={t('ordNo')} value={slip.order_no} mono />
          <Meta label={t('collectedAt')} value={formatDateTime(slip.collected_at, locale)} />
          <Meta label={t('orderedAt')} value={formatDateTime(slip.ordered_at, locale)} />
          <Meta label={t('customer')} value={slip.customer_name} />
          {slip.student_name ? (
            <Meta label={t('student')} value={slip.student_name} />
          ) : null}
          {slip.class_level ? <Meta label={t('class')} value={slip.class_level} /> : null}
          <Meta label={t('collectedBy')} value={slip.collector_name} />
          <Meta label={t('handedOverBy')} value={slip.handed_over_by} />
        </dl>

        <table className="w-full border-collapse py-4 text-xs">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 font-semibold">{t('description')}</th>
              <th className="py-2 text-right font-semibold">{t('quantity')}</th>
              <th className="py-2 text-right font-semibold">{t('value')}</th>
            </tr>
          </thead>
          <tbody>
            {slip.items.map((item) => (
              <tr key={item.id} className="border-b border-dashed">
                <td className="py-2">
                  {item.description}
                  {item.size ? (
                    <span className="text-neutral-500"> ({item.size})</span>
                  ) : null}
                </td>
                <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatMoney(item.line_total, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* No amount due: this slip moves goods, not money. The order was paid
            in full when it was placed. */}
        <p className="mt-3 text-xs text-neutral-600">{t('alreadyPaid')}</p>

        <div className="mt-8 flex items-end justify-between gap-8">
          <div className="flex-1">
            <p className="mb-1 text-[0.65rem] uppercase text-neutral-500">
              {t('collectorSignature')}
            </p>
            <div className="h-16 border-b border-neutral-400" />
          </div>
        </div>

        <footer className="mt-6 border-t pt-3 text-center text-[0.65rem] text-neutral-500">
          {t('footer')}
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
