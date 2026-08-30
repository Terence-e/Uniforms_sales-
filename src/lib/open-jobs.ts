import type { AlterationStatus, OrderStatus } from '@/types/database.types';

/**
 * The open-jobs list (A-FR-9.16, A-FR-9.17, A-FR-9.18).
 *
 * Orders and alterations are different things with different vocabularies -- a
 * garment is RECEIVED from its owner and RETURNED to them; a uniform is ORDERED
 * and COLLECTED -- but to the seller standing at the counter they are one pile
 * of work. This module is what lets both be one list without pretending they
 * are the same record.
 *
 * A card is one outstanding ORDER LINE or one alteration. An order for a blazer
 * and two shirts is three garments at possibly three different statuses, and a
 * single card could not honestly show that.
 */

export type JobKind = 'order' | 'alteration';

/**
 * The shared stage the filter works on.
 *
 * Cards still display each job's own status word -- calling an alteration
 * "ordered" would be wrong, and the seller reads these words aloud to parents.
 * The stage exists so one filter can span both, rather than the screen needing
 * two dropdowns that mean the same three things.
 */
export type JobStage = 'waiting' | 'in_progress' | 'ready';

export const JOB_STAGES = ['waiting', 'in_progress', 'ready'] as const;

export function orderStage(status: OrderStatus): JobStage | null {
  switch (status) {
    case 'ordered':
      return 'waiting';
    case 'in_production':
      return 'in_progress';
    case 'ready':
      return 'ready';
    default:
      // collected and cancelled are closed -- they leave the list entirely.
      return null;
  }
}

export function alterationStage(status: AlterationStatus): JobStage | null {
  switch (status) {
    case 'received':
      return 'waiting';
    case 'in_progress':
      return 'in_progress';
    case 'ready':
      return 'ready';
    default:
      // returned and cancelled are closed.
      return null;
  }
}

export type OpenJob = {
  /** Unique across both sources, so React keys and links stay unambiguous. */
  key: string;
  kind: JobKind;
  /** The row to link to: the order, or the alteration. */
  href: string;
  reference: string;
  stage: JobStage;
  /** The job's own status word, translated by the caller. */
  statusLabel: OrderStatus | AlterationStatus;
  studentName: string | null;
  classLevel: string | null;
  /** Who to call. Also what "search by parent name" matches. */
  customerName: string;
  garment: string;
  size: string | null;
  /** When the job started: ordered_at, or received_at. */
  openedAt: string;
  expectedReadyDate: string | null;
};

/**
 * Whole days the job has been open.
 *
 * Deliberately computed from calendar dates rather than elapsed milliseconds: a
 * job taken in yesterday afternoon is "1 day", not "0 days" because 24 hours
 * have not passed. That is how the shop counts, and the number is read as an
 * age, not a duration.
 */
export function daysOpen(openedAt: string, now: Date = new Date()): number {
  const opened = new Date(openedAt);
  const a = Date.UTC(opened.getFullYear(), opened.getMonth(), opened.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Past its expected date and still not finished. Drives the flag on the card. */
export function isOverdue(job: OpenJob, now: Date = new Date()): boolean {
  if (!job.expectedReadyDate) return false;
  const [y, m, d] = job.expectedReadyDate.split('-').map(Number);
  // Parsed as local rather than via Date(string), which would read a date-only
  // value as UTC midnight and flag a job a day early west of Greenwich.
  return new Date(y, m - 1, d).getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Oldest first (A-FR-9.17). The longest-waiting job is the one most likely to
 * be a problem, so it goes at the top and stays there until it is dealt with.
 */
export function sortOldestFirst(jobs: OpenJob[]): OpenJob[] {
  return [...jobs].sort(
    (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()
  );
}

/** Matches a student or parent name, case- and accent-insensitively. */
export function matchesSearch(job: OpenJob, query: string): boolean {
  const needle = normalise(query);
  if (!needle) return true;
  return (
    normalise(job.studentName ?? '').includes(needle) ||
    normalise(job.customerName).includes(needle) ||
    normalise(job.reference).includes(needle)
  );
}

/**
 * Lowercased and stripped of accents, so "Therese" finds "Thérèse". Names here
 * are typed by whoever is at the counter and rarely typed the same way twice.
 */
function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
