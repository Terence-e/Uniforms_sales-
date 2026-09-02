'use server';

import { createClient } from '@/lib/supabase/server';
import type {
  ChartMetric,
  ChartPeriod,
  ChartPoint,
  ChartSeries
} from '@/lib/dashboard-chart';
import type { PaymentMethod } from '@/types/database.types';

/**
 * Data for the dashboard chart. One action serves every combination of period
 * (weeks / months / years) and metric (sales, orders, discounts, payment
 * method) so the chart can switch without a page reload. Keys are returned raw
 * (a date, a month, a year, or a payment method) and formatted on the client,
 * where the locale lives. Types + option lists live in @/lib/dashboard-chart --
 * a 'use server' file may only export async functions.
 */

const num = (v: unknown) => Number(v ?? 0);
const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

type Bucket = { key: string; start: Date; end: Date };

function makeBuckets(period: ChartPeriod, now: Date): Bucket[] {
  const list: Bucket[] = [];
  if (period === 'daily') {
    const day0 = new Date(now);
    day0.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const start = new Date(day0);
      start.setDate(start.getDate() - i);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      list.push({ key: isoDate(start), start, end });
    }
  } else if (period === 'weekly') {
    const ws = startOfWeek(now);
    for (let i = 7; i >= 0; i--) {
      const start = new Date(ws);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      list.push({ key: isoDate(start), start, end });
    }
  } else if (period === 'monthly') {
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      list.push({ key: `${start.getFullYear()}-${pad(start.getMonth() + 1)}`, start, end });
    }
  } else {
    for (let i = 4; i >= 0; i--) {
      const start = new Date(now.getFullYear() - i, 0, 1);
      const end = new Date(now.getFullYear() - i + 1, 0, 1);
      list.push({ key: String(start.getFullYear()), start, end });
    }
  }
  return list;
}

function tally<T>(
  buckets: Bucket[],
  rows: T[],
  getDate: (r: T) => string,
  pick: (r: T) => number
): ChartPoint[] {
  return buckets.map((b) => {
    let value = 0;
    for (const r of rows) {
      const d = new Date(getDate(r));
      if (d >= b.start && d < b.end) value += pick(r);
    }
    return { key: b.key, value };
  });
}

export async function getDashboardChart(
  period: ChartPeriod,
  metric: ChartMetric
): Promise<ChartSeries> {
  const supabase = await createClient();
  const buckets = makeBuckets(period, new Date());
  const rangeStart = buckets[0].start.toISOString();

  // Orders: counted from ordered_at (RLS scopes to what the viewer may see).
  if (metric === 'orders') {
    const { data } = await supabase
      .from('orders')
      .select('ordered_at')
      .gte('ordered_at', rangeStart);
    return {
      metric,
      period,
      valueType: 'count',
      categorical: false,
      points: tally(buckets, data ?? [], (r) => r.ordered_at, () => 1)
    };
  }

  // Everything else comes from live (non-cancelled) sales.
  const { data } = await supabase
    .from('sales')
    .select('sold_at, total, discount, payment_method')
    .is('cancelled_at', null)
    .gte('sold_at', rangeStart);
  const sales = data ?? [];

  if (metric === 'payment') {
    const byMethod = new Map<PaymentMethod, number>();
    for (const s of sales) {
      byMethod.set(s.payment_method, (byMethod.get(s.payment_method) ?? 0) + num(s.total));
    }
    return {
      metric,
      period,
      valueType: 'money',
      categorical: true,
      points: Array.from(byMethod, ([key, value]) => ({ key, value }))
    };
  }

  const pick = metric === 'discounts' ? (s: (typeof sales)[number]) => num(s.discount) : (s: (typeof sales)[number]) => num(s.total);
  return {
    metric,
    period,
    valueType: 'money',
    categorical: false,
    points: tally(buckets, sales, (r) => r.sold_at, pick)
  };
}
