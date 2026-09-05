import { getTranslations, setRequestLocale } from 'next-intl/server';
import { listOpenJobs } from '@/actions/open-jobs';
import { getProfile } from '@/actions/auth';
import { OpenJobsBoard } from '@/components/open-jobs/open-jobs-board';
import { canOperate } from '@/lib/roles';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'OpenJobs' });
  return { title: t('title') };
}

export default async function OpenJobsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [jobs, profile, t] = await Promise.all([
    listOpenJobs(),
    getProfile(),
    getTranslations('OpenJobs')
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Sorted oldest first on the server (A-FR-9.17); the board filters and
          searches that list without reordering it. */}
      <OpenJobsBoard jobs={jobs} canOperate={canOperate(profile?.role)} />
    </div>
  );
}
