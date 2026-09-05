import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getAlteration } from '@/actions/alterations';
import { getProfile } from '@/actions/auth';
import { AlterationStatusControls } from '@/components/alterations/alteration-status-controls';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { canOperate } from '@/lib/roles';

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'Alterations' });
  const alteration = await getAlteration(id);
  return { title: alteration ? alteration.alteration_no : t('title') };
}

export default async function AlterationDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // RLS decides visibility, as everywhere else: whoever took the garment in
  // sees it, oversight roles see all, anyone else gets a 404 rather than a leak.
  const alteration = await getAlteration(id);
  if (!alteration) notFound();

  const [t, tSales, profile] = await Promise.all([
    getTranslations('Alterations'),
    getTranslations('Sales'),
    getProfile()
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {alteration.alteration_no}
          </h1>
          <p className="text-sm text-muted-foreground">
            {alteration.customer_name} ·{' '}
            {formatDateTime(alteration.received_at, locale)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/alterations/${alteration.id}/slip`}>{t('viewSlip')}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('statusTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <AlterationStatusControls
            alterationId={alteration.id}
            status={alteration.status}
            charge={alteration.charge}
            paidAt={alteration.paid_at}
            canOperate={canOperate(profile?.role)}
          />
          {alteration.status_reason ? (
            <p className="text-xs text-muted-foreground">
              {t('reason')}: {alteration.status_reason}
            </p>
          ) : null}
          {alteration.returned_at ? (
            <p className="text-xs text-muted-foreground">
              {t('returnedAt')}: {formatDateTime(alteration.returned_at, locale)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('garmentTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row
            label={t('garment')}
            value={
              alteration.size
                ? `${alteration.garment} (${alteration.size})`
                : alteration.garment
            }
          />
          <div>
            <p className="text-muted-foreground">{t('workRequired')}:</p>
            {/* Line breaks preserved: this is the text a disagreement months
                later gets settled against. */}
            <p className="whitespace-pre-wrap font-medium">{alteration.work_required}</p>
          </div>
          {alteration.expected_ready_date ? (
            <Row
              label={t('expectedReadyDate')}
              value={formatDate(alteration.expected_ready_date, locale)}
            />
          ) : null}
          {alteration.notes ? <Row label={t('notes')} value={alteration.notes} /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('chargeTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {alteration.charge > 0 ? (
            <>
              <Row label={t('charge')} value={formatMoney(alteration.charge, locale)} />
              <Row
                label={t('paymentState')}
                value={
                  alteration.paid_at
                    ? `${t('paidLabel')} · ${formatDateTime(alteration.paid_at, locale)}`
                    : t('dueOnReturn')
                }
              />
              {alteration.payment_method ? (
                <Row
                  label={tSales('paymentMethod')}
                  value={tSales(`payment.${alteration.payment_method}`)}
                />
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">{t('noCharge')}</p>
          )}
        </CardContent>
      </Card>

      {/* The rule the whole feature turns on, stated where someone reviewing a
          record can see it. */}
      <p className="text-xs text-muted-foreground">{t('noStockNotice')}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
