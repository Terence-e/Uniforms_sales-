import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getProfile } from '@/actions/auth';
import { ChangeMyPassword } from '@/components/profile/change-my-password';
import { ProfileEditor } from '@/components/profile/profile-editor';
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

  if (!profile) return null;

  const role = profile.role as UserRole;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <ProfileEditor
        fullName={profile.full_name}
        email={profile.email}
        roleLabel={tRoles(`roles.${role}`)}
        avatarUrl={profile.avatar_url}
        isActive={profile.is_active}
      />

      <ChangeMyPassword />
    </div>
  );
}
