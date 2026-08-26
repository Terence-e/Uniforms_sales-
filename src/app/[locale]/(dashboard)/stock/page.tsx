import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Stock' });
  return { title: t('title') };
}

export default async function StockPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Stock');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('comingSoon')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {/* The schema, triggers and policies are already in place; see
              supabase/migrations/20260101000100_stock.sql and
              src/actions/stock.ts for the read/write paths. */}
          <ul className="list-inside list-disc space-y-1">
            <li>stock_levels / stock_movements tables — done</li>
            <li>listStock(), recordStockMovement() — done</li>
            <li>Intake &amp; stocktake screens — to build</li>
            <li>Deduct stock on sale — to wire up</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
