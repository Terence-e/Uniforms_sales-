import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/actions/auth';

type Props = { params: Promise<{ locale: string }> };

/**
 * The app has no marketing page, so this decides where signing in puts you.
 *
 * A seller lands on the open-jobs board rather than the dashboard (A-FR-9.16).
 * The dashboard answers "how are we doing"; the board answers "what do I do
 * next", and for the person at the counter that is the whole job. It is the
 * part that replaces remembering, so it should be the first thing they see
 * rather than one click away.
 *
 * Every other role keeps the dashboard: administration and oversight want the
 * overview, and a super admin arriving at a list of garments to sew would be
 * looking at somebody else's work.
 *
 * The board is still reachable from the nav for everyone, and the dashboard is
 * still reachable for a seller -- this changes the landing, not the access.
 */
export default async function LocaleIndex({ params }: Props) {
  const { locale } = await params;

  // No profile means no session, or a session whose row cannot be read. Either
  // way the dashboard is the safe destination: it handles that case already,
  // and the proxy will bounce a signed-out visitor to login before this runs.
  const profile = await getProfile();
  const href = profile?.role === 'seller' ? '/open-jobs' : '/dashboard';

  redirect({ href, locale });
}
