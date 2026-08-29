import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getOrderWithItems } from '@/actions/orders';
import { ReceiptPrint, type ReceiptData } from '@/components/receipt/receipt-print';
import { deriveOrderStatus } from '@/lib/order-status';

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'Receipt' });
  const order = await getOrderWithItems(id);
  return { title: order ? `${t('orderTitle')} ${order.order_no}` : t('orderTitle') };
}

export default async function OrderReceiptPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // RLS decides visibility, exactly as on the sale receipt: a seller asking for
  // someone else's order gets no row back, which lands here as a 404.
  const order = await getOrderWithItems(id);
  if (!order) notFound();

  const receipt: ReceiptData = {
    kind: 'order',
    // Derived from the lines, the same rule the detail page and the order list
    // use -- so all three agree about what this order currently is.
    order_status: deriveOrderStatus((order.items ?? []).map((item) => item.status)),
    // The shared sheet labels this field by `kind`, so the order reference goes
    // in as the document number.
    receipt_no: order.order_no,
    sold_at: order.ordered_at,
    expected_ready_date: order.expected_ready_date,
    measurements: order.measurements,
    customer_name: order.customer_name,
    student_name: order.student_name,
    class_level: order.class_level,
    payment_method: order.payment_method,
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    notes: order.notes,
    signature_url: null,
    seller_name: order.seller?.full_name ?? '',
    items: order.items ?? []
  };

  return <ReceiptPrint receipt={receipt} />;
}
