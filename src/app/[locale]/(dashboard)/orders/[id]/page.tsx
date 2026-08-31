import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  getOrderWithItems,
  listCollectionsForOrder,
  listStaff
} from '@/actions/orders';
import { getProfile } from '@/actions/auth';
import { CollectionPanel } from '@/components/orders/collection-panel';
import { LineStatusControls } from '@/components/orders/line-status-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { deriveOrderStatus } from '@/lib/order-status';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'Orders' });
  const order = await getOrderWithItems(id);
  return { title: order ? `${t('detailTitle')} ${order.order_no}` : t('detailTitle') };
}

export default async function OrderDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // RLS decides visibility: a seller asking for someone else's order gets no
  // row back, which lands here as a 404 rather than a leak.
  const order = await getOrderWithItems(id);
  if (!order) notFound();

  const [t, tSales, tCol, staff, collections, profile] = await Promise.all([
    getTranslations('Orders'),
    getTranslations('Sales'),
    getTranslations('Collection'),
    listStaff(),
    listCollectionsForOrder(order.id),
    getProfile()
  ]);

  const items = order.items ?? [];
  // Only Ready lines can be handed over: anything earlier has not been made,
  // and anything later has already left or been cancelled.
  const collectable = items.filter((item) => item.status === 'ready');
  const overall = deriveOrderStatus(items.map((item) => item.status));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{order.order_no}</h1>
            {overall ? (
              <Badge variant={overall === 'cancelled' ? 'destructive' : 'secondary'}>
                {t(`status.${overall}`)}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {order.customer_name} · {formatDateTime(order.ordered_at, locale)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/orders/${order.id}/receipt`}>{t('viewReceipt')}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('detailSummary')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Row label={tSales('paymentMethod')} value={tSales(`payment.${order.payment_method}`)} />
          <Row label={t('paidInFull')} value={formatMoney(order.total, locale)} />
          {order.expected_ready_date ? (
            <Row
              label={t('expectedReadyDate')}
              value={formatDate(order.expected_ready_date, locale)}
            />
          ) : null}
          {order.student_name ? (
            <Row label={tSales('studentName')} value={order.student_name} />
          ) : null}
          {order.measurements ? (
            <Row label={t('measurements')} value={order.measurements} />
          ) : null}
        </CardContent>
      </Card>

      {profile ? (
        <CollectionPanel
          orderId={order.id}
          lines={collectable.map((line) => ({
            id: line.id,
            description: line.description,
            size: line.size,
            quantity: line.quantity,
            line_total: line.line_total
          }))}
          staff={staff}
          currentUserId={profile.id}
          locale={locale}
        />
      ) : null}

      {collections.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tCol('previous')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-[0.7rem]">
                    {collection.col_no}
                  </Badge>
                  <span className="text-muted-foreground">
                    {collection.collector_name} ·{' '}
                    {formatDateTime(collection.collected_at, locale)}
                  </span>
                </div>
                <Button asChild variant="link" size="sm" className="h-auto p-0">
                  <Link href={`/collections/${collection.id}`}>{tCol('viewSlip')}</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tSales('items')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">
                  {item.description}
                  {item.size ? (
                    <span className="text-muted-foreground"> ({item.size})</span>
                  ) : null}
                </p>
                <p className="tabular-nums text-sm">
                  {item.quantity} × {formatMoney(item.unit_price, locale)} ={' '}
                  <span className="font-medium">
                    {formatMoney(item.line_total, locale)}
                  </span>
                </p>
              </div>

              <LineStatusControls lineId={item.id} status={item.status} />

              {/* The reason behind the current status, when one was required.
                  The full history is in the audit log. */}
              {item.status_reason ? (
                <p className="text-xs text-muted-foreground">
                  {t('reason')}: {item.status_reason}
                </p>
              ) : null}
              {item.status === 'cancelled' && item.refund_method ? (
                <p className="text-xs text-muted-foreground">
                  {t('refundMethod')}: {tSales(`payment.${item.refund_method}`)}
                  {item.cancelled_at
                    ? ` · ${formatDateTime(item.cancelled_at, locale)}`
                    : null}
                </p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
