import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  listProducts,
  listRecentProduction,
  listStock,
  listTailorNames
} from '@/actions/stock';
import { listWaitingOrderCounts } from '@/actions/orders';
import { ProductionForm } from '@/components/forms/production-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatDate } from '@/lib/format';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Stock' });
  return { title: t('title') };
}

export default async function StockPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Fetched with the page rather than per selection: picking a product then
  // shows its waiting count instantly instead of waiting on a round trip.
  const [products, stock, tailors, recent, waiting, t, tProd] = await Promise.all([
    listProducts(),
    listStock(),
    listTailorNames(),
    listRecentProduction(10),
    listWaitingOrderCounts(),
    getTranslations('Stock'),
    getTranslations('Production')
  ]);

  const name = (product: { name_en: string; name_fr: string }) =>
    locale === 'fr' ? product.name_fr : product.name_en;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{tProd('subtitle')}</p>
      </div>

      <ProductionForm products={products} tailors={tailors} waiting={waiting} />

      {recent.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tProd('recent')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.map((movement) => (
              <div
                key={movement.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <span className="font-medium">
                    {movement.product ? name(movement.product) : '—'}
                    {movement.product?.size ? (
                      <span className="text-muted-foreground">
                        {' '}
                        ({movement.product.size})
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {movement.occurred_on ? formatDate(movement.occurred_on, locale) : ''}
                    {movement.tailor_name ? ` · ${movement.tailor_name}` : ''}
                  </span>
                </div>
                <Badge variant="secondary" className="tabular-nums">
                  +{movement.quantity}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('onHand')}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Read-only on purpose. Every number here is derived by the
              apply_stock_movement trigger from the ledger -- there is no field
              to edit one, which is what A-FR-5.4 asks for. */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('product')}</TableHead>
                  <TableHead>{t('size')}</TableHead>
                  <TableHead className="text-right">{t('quantity')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stock.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{name(product)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.size ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={product.isLow ? 'text-destructive font-medium' : ''}>
                        {product.quantity}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
