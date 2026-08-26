import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSaleWithItems } from '@/actions/sales';
import { ReceiptPrint, type ReceiptData } from '@/components/receipt/receipt-print';

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'Receipt' });
  const sale = await getSaleWithItems(id);
  return { title: sale ? `${t('title')} ${sale.receipt_no}` : t('title') };
}

export default async function ReceiptPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // RLS decides visibility: a seller asking for someone else's sale gets no
  // row back, which lands here as a 404 rather than a leak.
  const sale = await getSaleWithItems(id);
  if (!sale) notFound();

  const receipt: ReceiptData = {
    receipt_no: sale.receipt_no,
    sold_at: sale.sold_at,
    customer_name: sale.customer_name,
    student_name: sale.student_name,
    class_level: sale.class_level,
    payment_method: sale.payment_method,
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    notes: sale.notes,
    signature_url: sale.signature_url,
    seller_name: sale.seller?.full_name ?? '',
    items: sale.items ?? []
  };

  return <ReceiptPrint receipt={receipt} />;
}
