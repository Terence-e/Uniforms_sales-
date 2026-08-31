import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listRecentOrders } from '@/actions/orders';
import { listProducts } from '@/actions/stock';
import { OrderForm } from '@/components/forms/order-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Orders' });
  return { title: t('title') };
}

export default async function OrdersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Same reasoning as the sales page: one round trip, not a waterfall.
  const [products, recent, t] = await Promise.all([
    listProducts(),
    listRecentOrders(8),
    getTranslations('Orders')
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <OrderForm products={products} />
      </div>

      <Card className="h-fit lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle className="text-base">{t('recent')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noRecent')}</p>
          ) : (
            recent.map((order) => (
              <div
                key={order.id}
                className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{order.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(order.ordered_at, locale)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge variant="secondary" className="font-mono text-[0.7rem]">
                      {order.order_no}
                    </Badge>
                    <Badge variant="outline" className="text-[0.7rem]">
                      {t(`status.${order.status}`)}
                    </Badge>
                  </div>
                  {order.expected_ready_date ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('expectedReadyShort', {
                        date: formatDate(order.expected_ready_date, locale)
                      })}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular-nums text-sm font-medium">
                    {formatMoney(order.total, locale)}
                  </span>
                  <Button asChild variant="link" size="sm" className="h-auto p-0">
                    <Link href={`/orders/${order.id}`}>{t('viewOrder')}</Link>
                  </Button>
                  <Button asChild variant="link" size="sm" className="h-auto p-0">
                    <Link href={`/orders/${order.id}/receipt`}>{t('viewReceipt')}</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
