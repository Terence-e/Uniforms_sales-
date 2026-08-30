import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getProfile } from '@/actions/auth';
import { listBugReports } from '@/actions/bug-reports';
import { BugReportList } from '@/components/bug-report/bug-report-list';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'BugReport' });
  return { title: t('dashboardTitle') };
}

export default async function BugReportsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [profile, t] = await Promise.all([
    getProfile(),
    getTranslations('BugReport')
  ]);

  // A second lock, not the only one. RLS already returns nothing to anyone but
  // Maintenance and the Super Admin, so a seller reaching this URL would see an
  // empty page -- but an empty page reads as "no reports", which is a different
  // and misleading statement. 404 says "this is not yours".
  if (!profile || (profile.role !== 'maintenance' && profile.role !== 'super_admin')) {
    notFound();
  }

  const reports = await listBugReports();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('dashboardTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('dashboardSubtitle')}</p>
      </div>

      <BugReportList reports={reports} />
    </div>
  );
}
