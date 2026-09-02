/**
 * Types and constants for the dashboard chart. Kept out of the `'use server'`
 * action file, which may only export async functions -- the client component
 * imports the shapes and option lists from here, the action from actions/dashboard.
 */

export type ChartPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ChartMetric = 'sales' | 'orders' | 'discounts' | 'payment';

export const CHART_PERIODS: ChartPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];
export const CHART_METRICS: ChartMetric[] = ['sales', 'orders', 'discounts', 'payment'];

export type ChartPoint = { key: string; value: number };

export type ChartSeries = {
  metric: ChartMetric;
  period: ChartPeriod;
  /** money → format as currency; count → plain integer. */
  valueType: 'money' | 'count';
  /** true when keys are payment methods rather than time buckets. */
  categorical: boolean;
  points: ChartPoint[];
};
