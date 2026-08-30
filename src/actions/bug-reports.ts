'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * In-app bug reports: the failures Sentry never sees.
 *
 * A wrong total or a receipt naming the wrong parent does not throw, so nothing
 * automated will ever notice it. The only witness is the person at the counter.
 */

/** Roughly 1 MB of base64, matching the column's own check constraint. */
const MAX_SCREENSHOT = 1_500_000;

const bugReportSchema = z.object({
  description: z
    .string({ message: 'required' })
    .trim()
    .min(10, { message: 'describeMore' })
    .max(4000),
  /** Captured by the browser, not typed. Both are best-effort. */
  pageUrl: z.string().trim().max(500).nullable().default(null),
  userAgent: z.string().trim().max(500).nullable().default(null),
  screenshot: z
    .string()
    .max(MAX_SCREENSHOT, { message: 'screenshotTooLarge' })
    .nullable()
    .default(null)
});

export type BugReportInput = z.input<typeof bugReportSchema>;

export type SubmitBugReportResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Files a report (A-13).
 *
 * `reporter_id` comes from the session and `reporter_name` is copied in
 * alongside it: the FK nulls out if the account is later removed, and six
 * months on "who reported this" should still answer.
 */
export async function submitBugReport(
  input: BugReportInput
): Promise<SubmitBugReportResult> {
  const parsed = bugReportSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] ??= issue.message;
    }
    return { ok: false, error: 'validation', fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const report = parsed.data;
  const { error } = await supabase.from('bug_reports').insert({
    reporter_id: user.id,
    reporter_name: profile?.full_name ?? user.email ?? null,
    description: report.description,
    page_url: report.pageUrl,
    user_agent: report.userAgent,
    screenshot: report.screenshot
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/bug-reports', 'page');
  return { ok: true };
}

// ------------------------------------------------------------------ reading

/**
 * The report list for Maintenance.
 *
 * Deliberately does NOT select `screenshot`. Each one is up to a megabyte of
 * base64, and pulling thirty of them to render a list nobody has opened yet
 * would make the page crawl. It is fetched only when a report is expanded.
 *
 * RLS is what actually restricts this to Maintenance and the Super Admin --
 * a seller calling it gets an empty list, not an error.
 */
export async function listBugReports(limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('bug_reports')
    .select(
      'id, reported_at, reporter_name, description, page_url, user_agent, resolved_at'
    )
    .order('reported_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** One report's screenshot, fetched only when someone opens it. */
export async function getBugReportScreenshot(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('bug_reports')
    .select('screenshot')
    .eq('id', id)
    .single();
  return data?.screenshot ?? null;
}

/** How many are still outstanding, for the nav badge. */
export async function countOpenBugReports(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('bug_reports')
    .select('id', { count: 'exact', head: true })
    .is('resolved_at', null);
  return count ?? 0;
}

export async function setBugReportResolved(
  id: string,
  resolved: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase
    .from('bug_reports')
    .update({
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? user.id : null
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/bug-reports', 'page');
  return { ok: true };
}
