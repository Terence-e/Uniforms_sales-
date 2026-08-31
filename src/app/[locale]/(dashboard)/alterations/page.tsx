import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listAlterations } from '@/actions/alterations';
import { AlterationForm } from '@/components/forms/alteration-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isOpen } from '@/lib/alteration-status';
import { formatDate, formatMoney } from '@/lib/format';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Alterations' });
  return { title: t('title') };
}

export default async function AlterationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [alterations, t] = await Promise.all([
    listAlterations(20),
    getTranslations('Alterations')
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <AlterationForm />
      </div>

      <Card className="h-fit lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle className="text-base">{t('recent')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {alterations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noneYet')}</p>
          ) : (
            alterations.map((alteration) => (
              <div
                key={alteration.id}
                className="space-y-1 border-b pb-3 last:border-0 last:pb-0"
              >
                <p className="truncate text-sm font-medium">
                  {alteration.garment}
                  {alteration.size ? (
                    <span className="text-muted-foreground"> ({alteration.size})</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {alteration.student_name || alteration.customer_name}
                  {alteration.class_level ? ` · ${alteration.class_level}` : ''}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant="secondary" className="font-mono text-[0.7rem]">
                    {alteration.alteration_no}
                  </Badge>
                  <Badge
                    variant={alteration.status === 'cancelled' ? 'destructive' : 'outline'}
                    className="text-[0.7rem]"
                  >
                    {t(`status.${alteration.status}`)}
                  </Badge>
                  {/* Money owed matters more than the workflow step when the
                      garment is about to go back, so it is flagged here too. */}
                  {alteration.charge > 0 && !alteration.paid_at ? (
                    <Badge
                      variant="outline"
                      className="border-amber-500 text-[0.7rem] text-amber-600"
                    >
                      {formatMoney(alteration.charge, locale)}
                    </Badge>
                  ) : null}
                </div>
                {isOpen(alteration.status) && alteration.expected_ready_date ? (
                  <p className="text-xs text-muted-foreground">
                    {t('expectedShort', {
                      date: formatDate(alteration.expected_ready_date, locale)
                    })}
                  </p>
                ) : null}
                <Button asChild variant="link" size="sm" className="h-auto p-0">
                  <Link href={`/alterations/${alteration.id}`}>{t('open')}</Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
