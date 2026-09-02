'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { getDashboardChart } from '@/actions/dashboard';
import {
  CHART_METRICS,
  CHART_PERIODS,
  type ChartMetric,
  type ChartPeriod,
  type ChartSeries
} from '@/lib/dashboard-chart';
import { formatMoney } from '@/lib/format';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

/**
 * Dashboard chart with period (weeks/months/years) and metric (sales, orders,
 * discounts, payment methods) switches. Switching re-fetches through a server
 * action inside a transition, so the bars update in place without a reload.
 */
export function DashboardChart({
  initial,
  locale,
  emptyLabel
}: {
  initial: ChartSeries;
  locale: string;
  emptyLabel: string;
}) {
  const t = useTranslations('Dashboard');
  const [series, setSeries] = useState<ChartSeries>(initial);
  const [period, setPeriod] = useState<ChartPeriod>(initial.period);
  const [metric, setMetric] = useState<ChartMetric>(initial.metric);
  const [pending, startTransition] = useTransition();

  function apply(nextPeriod: ChartPeriod, nextMetric: ChartMetric) {
    setPeriod(nextPeriod);
    setMetric(nextMetric);
    startTransition(async () => {
      setSeries(await getDashboardChart(nextPeriod, nextMetric));
    });
  }

  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'short' });
  const dayFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });

  const labelFor = (key: string) => {
    if (series.categorical) return t(`chart.methods.${key}`);
    if (series.period === 'daily' || series.period === 'weekly') {
      return dayFmt.format(new Date(`${key}T00:00:00`));
    }
    if (series.period === 'monthly') return monthFmt.format(new Date(`${key}-01T00:00:00`));
    return key;
  };
  const fmtValue = (v: number) =>
    series.valueType === 'money' ? formatMoney(v, locale) : String(Math.round(v));
  const fmtAxis = (v: number) =>
    series.valueType === 'money' ? compact.format(v) : String(Math.round(v));

  const points = series.points;
  const maxVal = Math.max(...points.map((p) => p.value), 0);
  const nice = niceMax(maxVal);
  const allZero = maxVal === 0;
  const grid = [1, 0.75, 0.5, 0.25, 0];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={metric} onValueChange={(v) => apply(period, v as ChartMetric)}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHART_METRICS.map((m) => (
              <SelectItem key={m} value={m}>
                {t(`chart.metrics.${m}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(v) => apply(v as ChartPeriod, metric)}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHART_PERIODS.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`chart.periods.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pending ? <Spinner className="size-4" /> : null}
      </div>

      {/* Bars */}
      <div className={pending ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        <div className="relative h-60">
          {grid.map((f) => (
            <div
              key={f}
              className="absolute inset-x-0 flex items-center gap-2"
              style={{ top: `${(1 - f) * 100}%` }}
            >
              <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground/70">
                {f === 0 ? '0' : fmtAxis(nice * f)}
              </span>
              <div className="h-px flex-1 bg-border/70" />
            </div>
          ))}

          <div className="absolute inset-0 flex items-end gap-2 pl-[56px]">
            {points.map((p) => {
              const h = allZero ? 0 : (p.value / nice) * 100;
              return (
                <div key={p.key} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-center text-xs shadow-md group-hover:block">
                    <p className="font-medium">{labelFor(p.key)}</p>
                    <p className="text-muted-foreground">{fmtValue(p.value)}</p>
                  </div>
                  <div
                    className="mx-auto w-full max-w-[30px] rounded-t-md bg-primary/80 transition-[height,background-color] duration-300 group-hover:bg-primary"
                    style={{ height: `max(3px, ${h}%)` }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-2 flex gap-2 pl-[56px]">
          {points.map((p) => (
            <span key={p.key} className="flex-1 truncate text-center text-[11px] text-muted-foreground">
              {labelFor(p.key)}
            </span>
          ))}
        </div>
      </div>

      {allZero ? <p className="text-center text-sm text-muted-foreground">{emptyLabel}</p> : null}
    </div>
  );
}
