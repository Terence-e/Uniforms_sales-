import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSalesSummary } from '@/actions/sales';
import { ExportPanel } from '@/components/forms/export-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney, toDateInputValue } from '@/lib/format';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Reports' });
  return { title: t('title') };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { from: rawFrom, to: rawTo } = await searchParams;
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Reject anything that isn't a plain date before it reaches `new Date()`.
  const from = rawFrom && DATE_RE.test(rawFrom) ? rawFrom : toDateInputValue(monthStart);
  const to = rawTo && DATE_RE.test(rawTo) ? rawTo : toDateInputValue(today);

  const [summary, t] = await Promise.all([
    getSalesSummary(from, to),
    getTranslations('Reports')
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('export')}</CardTitle>
          <CardDescription>
            {summary.count === 0
              ? t('empty')
              : t('summary', {
                  count: summary.count,
                  total: formatMoney(summary.total, locale)
                })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportPanel initialFrom={from} initialTo={to} />
        </CardContent>
      </Card>
    </div>
  );
}
