'use server';

import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

/**
 * Recording that a document was reprinted (A-FR-7.12).
 *
 * Every reprint is logged with who and when. That is the half of the
 * requirement the stamp cannot cover: the stamp warns whoever is holding the
 * paper, while the log is what answers "how many copies of this receipt exist,
 * and who asked for them" weeks later.
 *
 * Called as the reprint page renders rather than when Print is clicked, so a
 * reprint is recorded even if the operator uses the browser's own print
 * command or simply photographs the screen. The consequence is that reloading
 * the page logs again -- which is honest: each render produced another
 * duplicate on screen, and an audit trail that under-reports is worse than one
 * that repeats.
 */
export type ReprintKind = 'sale' | 'order' | 'collection' | 'alteration';

const TARGET_TABLE: Record<ReprintKind, string> = {
  sale: 'sales',
  order: 'orders',
  collection: 'collections',
  alteration: 'alterations'
};

export async function logReprint(params: {
  kind: ReprintKind;
  id: string;
  /** The document's own number -- R-, ORD-, COL- or ALT- -- for readability. */
  reference: string;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  // Never throws: logAudit swallows its own errors, because failing to record a
  // reprint must not stop the operator handing a parent their paperwork.
  await logAudit({
    actorId: user.id,
    actorName: profile?.full_name ?? user.email ?? null,
    action: 'document_reprinted',
    entity: params.reference,
    targetTable: TARGET_TABLE[params.kind],
    targetId: params.id,
    meta: { kind: params.kind, reference: params.reference }
  });
}

/**
 * Whether this render is a reprint.
 *
 * A URL flag, by decision: the "Reprint" button on a record links here, and the
 * plain document URL stays the original. Worth knowing the limit -- trimming
 * `?reprint=1` yields an unstamped copy, so the stamp deters rather than
 * prevents. Closing that would mean recording on the record itself whether it
 * had ever been printed.
 */
export async function isReprintRequest(
  searchParams: Promise<{ reprint?: string }>
): Promise<boolean> {
  const { reprint } = await searchParams;
  return reprint === '1';
}
