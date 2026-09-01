import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getProfile } from '@/actions/auth';
import { listReturnPolicy } from '@/actions/return-policy';
import { ReturnPolicyForm } from '@/components/settings/return-policy-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Settings' });
  return { title: t('title') };
}

/**
 * Settings, Super Admin only (A-FR-8.8).
 *
 * RLS refuses the write regardless of what this page renders -- a seller who
 * could widen a window to fit the return they are currently recording would
 * make the override, and the whole out-of-policy report, meaningless. The role
 * check here just stops the screen from offering something that will be
 * refused.
 */
export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [profile, t] = await Promise.all([getProfile(), getTranslations('Settings')]);
  if (profile?.role !== 'super_admin') notFound();

  const rows = await listReturnPolicy();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('returnPolicy')}</CardTitle>
          <CardDescription>{t('returnPolicyHelp')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ReturnPolicyForm rows={rows} />
        </CardContent>
      </Card>

      {/* Said plainly, because it is the part people get wrong about editable
          policy: changing a window does not reclassify anything already
          recorded. Every return stores the verdict it was given at the time. */}
      <p className="text-xs text-muted-foreground">{t('notRetroactive')}</p>
    </div>
  );
}
