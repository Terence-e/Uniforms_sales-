import { getTranslations } from 'next-intl/server';
import { BanknoteIcon, SmartphoneIcon, TriangleAlertIcon } from 'lucide-react';
import type { DailyReconciliation as Recon, MethodTotal } from '@/actions/reports';
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
import { formatDateTime, formatMoney } from '@/lib/format';

/**
 * Daily cash reconciliation (A-FR-12.1). Cash and mobile money are presented in
 * separate blocks and never summed together: the box figure is cash-only, and
 * mobile money is a checklist to reconcile against the phone.
 */
export async function DailyReconciliation({
  data,
  locale
}: {
  data: Recon;
  locale: string;
}) {
  const t = await getTranslations('Reports');
  const money = (n: number) => formatMoney(n, locale);
  const methodLabel = (m: string) => t(`recon.methods.${m}`);

  const methodRows = (rows: MethodTotal[]) =>
    rows.length === 0 ? (
      <TableRow>
        <TableCell colSpan={3} className="py-4 text-center text-muted-foreground">
          {t('recon.none')}
        </TableCell>
      </TableRow>
    ) : (
      rows.map((r) => (
        <TableRow key={r.method}>
          <TableCell className="font-medium">{methodLabel(r.method)}</TableCell>
          <TableCell className="text-right tabular-nums">{r.count}</TableCell>
          <TableCell className="text-right tabular-nums">{money(r.total)}</TableCell>
        </TableRow>
      ))
    );

  return (
    <div className="space-y-6">
      {/* Headline figures */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('recon.transactions')} value={String(data.transactionCount)} />
        <Stat label={t('recon.grossSales')} value={money(data.grossSales)} />
        <Stat label={t('recon.discountsTotal')} value={money(data.discountsTotal)} />
        <Stat label={t('recon.netCollected')} value={money(data.netCollected)} />
      </div>

      {/* Cash vs mobile money -- deliberately two separate blocks. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BanknoteIcon className="size-4" />
              {t('recon.netCashInBox')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold tabular-nums">{money(data.netCashInBox)}</p>
            <p className="text-sm text-muted-foreground">{t('recon.netCashInBoxHint')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SmartphoneIcon className="size-4" />
              {t('recon.mobileMoneyCheck')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold tabular-nums">{money(data.mobileMoney.total)}</p>
            <p className="text-sm text-muted-foreground">{t('recon.mobileMoneyHint')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Collected by method */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('recon.byMethod')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('recon.method')}</TableHead>
                <TableHead className="text-right">{t('recon.count')}</TableHead>
                <TableHead className="text-right">{t('recon.total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{methodRows(data.byMethod)}</TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Refunds by method */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('recon.refundsByMethod')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('recon.method')}</TableHead>
                <TableHead className="text-right">{t('recon.count')}</TableHead>
                <TableHead className="text-right">{t('recon.total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{methodRows(data.refundsByMethod)}</TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile money transactions with references */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('recon.mobileMoneyList')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('recon.receipt')}</TableHead>
                  <TableHead>{t('recon.method')}</TableHead>
                  <TableHead>{t('recon.reference')}</TableHead>
                  <TableHead>{t('recon.receiver')}</TableHead>
                  <TableHead className="text-right">{t('recon.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.mobileMoney.transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-4 text-center text-muted-foreground">
                      {t('recon.none')}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.mobileMoney.transactions.map((tx) => (
                    <TableRow key={tx.receiptNo}>
                      <TableCell className="font-mono">{tx.receiptNo}</TableCell>
                      <TableCell>{methodLabel(tx.method)}</TableCell>
                      <TableCell className="font-mono">{tx.reference ?? '—'}</TableCell>
                      <TableCell>{tx.receiver}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(tx.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Money for undelivered orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TriangleAlertIcon className="size-4" />
            {t('recon.undelivered')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-2xl font-semibold tabular-nums">
            {money(data.undeliveredOrdersTotal)}
          </p>
          <p className="text-sm text-muted-foreground">{t('recon.undeliveredHint')}</p>
        </CardContent>
      </Card>

      {/* Breakdown by receiver */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('recon.byReceiver')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('recon.receiver')}</TableHead>
                <TableHead className="text-right">{t('recon.count')}</TableHead>
                <TableHead className="text-right">{t('recon.total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byReceiver.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-4 text-center text-muted-foreground">
                    {t('recon.none')}
                  </TableCell>
                </TableRow>
              ) : (
                data.byReceiver.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.total)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Discounts granted, with reasons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('recon.discountsGranted')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('recon.receipt')}</TableHead>
                  <TableHead>{t('recon.reason')}</TableHead>
                  <TableHead className="text-right">{t('recon.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.discounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-4 text-center text-muted-foreground">
                      {t('recon.none')}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.discounts.map((d) => (
                    <TableRow key={d.receiptNo}>
                      <TableCell className="font-mono">{d.receiptNo}</TableCell>
                      <TableCell>{d.reason ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(d.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Cancellations -- shown separately, never in revenue */}
      {/* Returns and exchanges (A-FR-8.12). Its own card rather than a column
          in Cancellations: both move money back to a parent, but a cancelled
          order line and a returned garment are reconciled separately, and the
          override flag only means something here. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {t('recon.returns')}
            {/* The headline number the administration is looking for: how often
                the rule was set aside in this period. Shown even when zero,
                because "none" is the answer they want most days. */}
            <Badge variant={data.overrideCount > 0 ? 'destructive' : 'secondary'}>
              {t('recon.overrides', { count: data.overrideCount })}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('recon.reference')}</TableHead>
                  <TableHead>{t('recon.originalSale')}</TableHead>
                  <TableHead>{t('recon.kind')}</TableHead>
                  <TableHead>{t('recon.policy')}</TableHead>
                  <TableHead>{t('recon.method')}</TableHead>
                  <TableHead>{t('recon.by')}</TableHead>
                  <TableHead className="text-right">{t('recon.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.returns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-4 text-center text-muted-foreground">
                      {t('recon.none')}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.returns.map((r) => {
                    const method = r.refund > 0 ? r.refundMethod : r.collectedMethod;
                    return (
                      <TableRow key={r.returnNo}>
                        <TableCell className="font-mono">{r.returnNo}</TableCell>
                        <TableCell className="font-mono">{r.saleReceiptNo}</TableCell>
                        <TableCell>{t(`recon.returnKinds.${r.kind}`)}</TableCell>
                        <TableCell>
                          {r.withinPolicy === false ? (
                            <span
                              className="font-medium text-destructive"
                              title={r.overrideReason ?? undefined}
                            >
                              {t('recon.override')}
                            </span>
                          ) : r.withinPolicy ? (
                            t('recon.withinPolicy')
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>{method ? methodLabel(method) : '—'}</TableCell>
                        <TableCell>{r.seller ?? '—'}</TableCell>
                        {/* Signed: a refund leaves the till, a top-up on a
                            dearer exchange comes into it. */}
                        <TableCell className="text-right tabular-nums">
                          {r.refund > 0 ? `− ${money(r.refund)}` : money(r.collected)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('recon.cancellations')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('recon.order')}</TableHead>
                  <TableHead>{t('recon.item')}</TableHead>
                  <TableHead>{t('recon.reason')}</TableHead>
                  <TableHead>{t('recon.refundMethod')}</TableHead>
                  <TableHead>{t('recon.when')}</TableHead>
                  <TableHead className="text-right">{t('recon.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cancellations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-4 text-center text-muted-foreground">
                      {t('recon.none')}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.cancellations.map((c, i) => (
                    <TableRow key={`${c.orderNo}-${i}`}>
                      <TableCell className="font-mono">{c.orderNo}</TableCell>
                      <TableCell>{c.description}</TableCell>
                      <TableCell>{c.reason ?? '—'}</TableCell>
                      <TableCell>{c.refundMethod ? methodLabel(c.refundMethod) : '—'}</TableCell>
                      <TableCell>{c.at ? formatDateTime(c.at, locale) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(c.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
