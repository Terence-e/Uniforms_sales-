import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getProfile } from '@/actions/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UserRole } from '@/types/database.types';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dashboard' });
  return { title: t('title') };
}

// Temporary, role-aware preview of the Phase 1 feature areas (spec A-2, A-4..A-12).
// Each role only sees the modules the requirements grant it; `write`/`read`
// mirror the RLS predicates (can_operate / can_oversee / is_super_admin). Modules
// with a real page today link out; the rest are labelled "Planned".

type Access = 'write' | 'read';
type ModuleKey =
  | 'sales'
  | 'openJobs'
  | 'production'
  | 'returns'
  | 'cancellations'
  | 'receipts'
  | 'catalogue'
  | 'reports'
  | 'audit'
  | 'accounts';

const ORDER: ModuleKey[] = [
  'sales',
  'openJobs',
  'production',
  'returns',
  'cancellations',
  'receipts',
  'catalogue',
  'reports',
  'audit',
  'accounts'
];

// Who gets what, and at what access level. Absent = the role never sees it.
const ACCESS: Record<ModuleKey, Partial<Record<UserRole, Access>>> = {
  sales: { seller: 'write', administration: 'read', maintenance: 'write', super_admin: 'write' },
  openJobs: { seller: 'write', administration: 'read', maintenance: 'write', super_admin: 'write' },
  production: { seller: 'write', administration: 'read', maintenance: 'write', super_admin: 'write' },
  returns: { seller: 'write', maintenance: 'write', super_admin: 'write' },
  cancellations: { seller: 'write', maintenance: 'write', super_admin: 'write' },
  receipts: { seller: 'read', administration: 'read', maintenance: 'read', super_admin: 'read' },
  catalogue: { seller: 'read', administration: 'read', maintenance: 'read', super_admin: 'write' },
  reports: { seller: 'read', administration: 'read', maintenance: 'read', super_admin: 'read' },
  audit: { seller: 'read', administration: 'read', maintenance: 'read', super_admin: 'read' },
  accounts: { super_admin: 'write' }
};

// The modules that already have a screen. The rest render as "Planned".
const HREF: Partial<Record<ModuleKey, string>> = {
  sales: '/sales',
  production: '/stock',
  reports: '/reports'
};

export default async function DashboardHome({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [profile, t] = await Promise.all([
    getProfile(),
    getTranslations('Dashboard')
  ]);

  // The layout already redirects anonymous visitors; this satisfies the types.
  if (!profile) return null;

  const role = profile.role as UserRole;
  const name = profile.full_name || profile.email;
  const modules = ORDER.filter((key) => ACCESS[key][role]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('greeting', { name })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('roleIntro', { role: t(`roles.${role}`) })} — {t(`summary.${role}`)}
        </p>
        <p className="text-xs text-muted-foreground/70">{t('previewNote')}</p>
      </div>

      {role === 'administration' && (
        <div className="rounded-md border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t('readonlyBanner')}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          {t('sectionTitle')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((key) => {
            const access = ACCESS[key][role] as Access;
            const href = HREF[key];
            return (
              <Card key={key} className="flex flex-col">
                <CardHeader className="gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      {t(`modules.${key}.title`)}
                    </CardTitle>
                    <Badge variant={access === 'write' ? 'secondary' : 'outline'}>
                      {access === 'write' ? t('accessWrite') : t('accessRead')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="mt-auto flex items-end justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {t(`modules.${key}.desc`)}
                  </p>
                  {href ? (
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                      <Link href={href}>{t('open')}</Link>
                    </Button>
                  ) : (
                    <Badge variant="ghost" className="shrink-0">
                      {t('planned')}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
