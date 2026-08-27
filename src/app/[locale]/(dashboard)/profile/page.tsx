import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getProfile } from '@/actions/auth';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UserRole } from '@/types/database.types';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Profile' });
  return { title: t('title') };
}

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [profile, t, tRoles] = await Promise.all([
    getProfile(),
    getTranslations('Profile'),
    getTranslations('Dashboard')
  ]);

  // The layout already redirects anonymous visitors; this satisfies the types.
  if (!profile) return null;

  const role = profile.role as UserRole;

  const rows = [
    { label: t('fullName'), value: profile.full_name || t('notSet') },
    { label: t('email'), value: profile.email || t('notSet') },
    { label: t('role'), value: tRoles(`roles.${role}`) }
  ];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{profile.full_name || profile.email}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 py-3 first:pt-0"
              >
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="text-sm font-medium">{row.value}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
              <dt className="text-sm text-muted-foreground">{t('status')}</dt>
              <dd>
                <Badge variant={profile.is_active ? 'secondary' : 'destructive'}>
                  {profile.is_active ? t('active') : t('inactive')}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
