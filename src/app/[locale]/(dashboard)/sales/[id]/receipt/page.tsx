import { isReprintRequest, logReprint } from '@/actions/reprints';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSaleWithItems } from '@/actions/sales';
import { listReturnsForSale } from '@/actions/returns';
import { Link } from '@/i18n/navigation';
import { ReceiptPrint, type ReceiptData } from '@/components/receipt/receipt-print';

type Props = {
  params: Promise<{ locale: string; id: string }>;
  /** `?reprint=1` marks the sheet DUPLICATA / DUPLICATE and logs it. */
  searchParams: Promise<{ reprint?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'Receipt' });
  const sale = await getSaleWithItems(id);
  return { title: sale ? `${t('title')} ${sale.receipt_no}` : t('title') };
}

export default async function ReceiptPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // RLS decides visibility: a seller asking for someone else's sale gets no
  // row back, which lands here as a 404 rather than a leak.
  const sale = await getSaleWithItems(id);
  if (!sale) notFound();

  const t = await getTranslations({ locale, namespace: 'Receipt' });


  // A reprint is stamped and recorded; the plain URL stays the original
  // (A-FR-7.12).
  const duplicate = await isReprintRequest(searchParams);
  if (duplicate) {
    await logReprint({ kind: 'sale', id: sale.id, reference: sale.receipt_no });
  }
  const receipt: ReceiptData = {
    duplicate,
    record_id: sale.id,
    receipt_no: sale.receipt_no,
    sold_at: sale.sold_at,
    customer_name: sale.customer_name,
    student_name: sale.student_name,
    class_level: sale.class_level,
    payment_method: sale.payment_method,
    subtotal: sale.subtotal,
    discount: sale.discount,
    discount_reason: sale.discount_reason,
    total: sale.total,
    notes: sale.notes,
    signature_url: sale.signature_url,
    seller_name: sale.seller?.full_name ?? '',
    recorded_by_name: sale.recordedBy?.full_name ?? null,
    received_by_name: sale.receivedBy?.full_name ?? null,
    payment_reference: sale.payment_reference,
    items: sale.items ?? []
  };

  // A-FR-8.6: the sale is unchanged, and both transactions stay visible. The
  // sale keeps saying what it always said; the returns against it are shown
  // beside it rather than folded into it.
  //
  // print:hidden -- the parent's copy of the sale is the sale. Each return has
  // its own RTN receipt, and printing them together would blur exactly the
  // separation this requirement is about.
  const returns = await listReturnsForSale(sale.id);

  return (
    <>
      {returns.length > 0 ? (
        <div className="mb-4 rounded-lg border border-amber-500 bg-amber-50 p-4 text-sm dark:bg-amber-950/30 print:hidden">
          <p className="font-semibold">{t('hasReturns')}</p>
          <ul className="mt-1 space-y-0.5">
            {returns.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/returns/${row.id}/receipt`}
                  className="font-mono hover:underline"
                >
                  {row.return_no}
                </Link>
                <span className="text-muted-foreground"> — {row.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ReceiptPrint receipt={receipt} />
    </>
  );
}
