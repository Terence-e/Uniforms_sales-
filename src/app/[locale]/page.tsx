import { redirect } from '@/i18n/navigation';

type Props = { params: Promise<{ locale: string }> };

/** The app has no marketing page -- land people on their role dashboard. */
export default async function LocaleIndex({ params }: Props) {
  const { locale } = await params;
  redirect({ href: '/dashboard', locale });
}
