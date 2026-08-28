import {
  ShoppingCartIcon,
  BanknoteIcon,
  BoxesIcon,
  TriangleAlertIcon,
  UsersIcon,
  type LucideIcon
} from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getProfile, countActiveUsers } from '@/actions/auth';
import { getSalesSummary, getMonthlySales, listRecentSales } from '@/actions/sales';
import { listStock } from '@/actions/stock';
import { SalesBarChart } from '@/components/dashboard/sales-bar-chart';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime, formatMoney, toDateInputValue } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/database.types';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dashboard' });
  return { title: t('title') };
}

type TileKey = 'salesMonth' | 'revenueMonth' | 'products' | 'lowStock' | 'users';

// Each role sees only what it actually handles.
const TILES: Record<UserRole, TileKey[]> = {
  seller: ['salesMonth', 'revenueMonth', 'lowStock', 'products'],
  administration: ['salesMonth', 'revenueMonth', 'products', 'lowStock'],
  maintenance: ['salesMonth', 'revenueMonth', 'products', 'lowStock'],
  super_admin: ['salesMonth', 'revenueMonth', 'products', 'users']
};

export default async function DashboardHome({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Cached from the layout's call -- effectively free here.
  const profile = await getProfile();
  if (!profile) return null;
  const role = profile.role as UserRole;

  const [t, summary, monthly, recent, stock, users] = await Promise.all([
    getTranslations('Dashboard'),
    getSalesSummary(toDateInputValue(monthStart), toDateInputValue(today)),
    getMonthlySales(8),
    listRecentSales(6),
    listStock(),
    // Only the Super Admin tile shows this -- skip the query for everyone else.
    role === 'super_admin' ? countActiveUsers() : Promise.resolve(0)
  ]);
  const name = profile.full_name || profile.email;
  const lowItems = stock.filter((p) => p.reorderLevel > 0 && p.quantity <= p.reorderLevel);
  const isReadOnly = role === 'administration';

  const tileDefs: Record<TileKey, { icon: LucideIcon; tone: string; value: string }> = {
    salesMonth: { icon: ShoppingCartIcon, tone: 'bg-primary/10 text-primary', value: String(summary.count) },
    revenueMonth: {
      icon: BanknoteIcon,
      tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      value: formatMoney(summary.total, locale)
    },
    products: {
      icon: BoxesIcon,
      tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
      value: String(stock.length)
    },
    lowStock: {
      icon: TriangleAlertIcon,
      tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
      value: String(lowItems.length)
    },
    users: {
      icon: UsersIcon,
      tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
      value: String(users)
    }
  };

  const tiles = TILES[role];
  const chartTitle = role === 'seller' ? t('overview.yourSales') : t('overview.salesTrend');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('overview.welcome', { name })}
          </h1>
          <p className="text-sm text-muted-foreground">{t('overview.subtitle')}</p>
        </div>
        {isReadOnly && (
          <Badge variant="secondary" className="h-6">
            {t('overview.readOnly')}
          </Badge>
        )}
      </div>

      {/* Stat tiles (role-specific) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((key) => {
          const def = tileDefs[key];
          const Icon = def.icon;
          return (
            <Card key={key}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className={cn('flex size-10 items-center justify-center rounded-xl', def.tone)}>
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t(`overview.stat_${key}`)}</p>
                  <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
                    {def.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {/* Sales chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{chartTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesBarChart data={monthly} locale={locale} emptyLabel={t('overview.chartEmpty')} />
          </CardContent>
        </Card>

        {/* Low stock alert */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">{t('overview.lowStock')}</CardTitle>
            <Link href="/stock" className="text-sm font-medium text-primary hover:underline">
              {t('overview.viewAll')}
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('overview.noLowStock')}
              </p>
            ) : (
              lowItems.slice(0, 5).map((p) => {
                const productName = locale === 'fr' ? p.name_fr : p.name_en;
                const ratio = p.reorderLevel > 0 ? Math.min(1, p.quantity / p.reorderLevel) : 0;
                return (
                  <div key={p.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {productName}
                          {p.size ? ` · ${p.size}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">{p.sku}</p>
                      </div>
                      <Badge variant="destructive" className="shrink-0">
                        {t('overview.stockLabel', { n: p.quantity })}
                      </Badge>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-destructive"
                        style={{ width: `${Math.max(6, ratio * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">{t('overview.recentActivity')}</CardTitle>
          <Link href="/sales" className="text-sm font-medium text-primary hover:underline">
            {t('overview.viewAll')}
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('overview.noActivity')}
            </p>
          ) : (
            recent.map((sale) => (
              <Link
                key={sale.id}
                href={`/sales/${sale.id}/receipt`}
                className="flex items-center justify-between gap-3 rounded-lg border bg-secondary/40 px-4 py-3 transition-colors hover:bg-secondary"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{sale.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(sale.sold_at, locale)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant="secondary" className="font-mono text-[0.7rem]">
                    {sale.receipt_no}
                  </Badge>
                  <span className="tabular-nums text-sm font-semibold">
                    {formatMoney(sale.total, locale)}
                  </span>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
