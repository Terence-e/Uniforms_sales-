'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  advanceAlterationSchema,
  alterationSchema,
  cancelAlterationSchema,
  payAlterationSchema,
  revertAlterationSchema,
  type AdvanceAlterationInput,
  type AlterationInput,
  type CancelAlterationInput,
  type PayAlterationInput,
  type RevertAlterationInput
} from '@/lib/validation/alteration-schema';
import { nextStatus, previousStatus } from '@/lib/alteration-status';
import type { AlterationStatus } from '@/types/database.types';

/**
 * Alterations: a garment the parent already owns, brought in to be altered.
 *
 * NOTHING in this file writes stock_movements, and nothing should. The garment
 * never entered inventory, so it can never leave it (A-FR-9.15). If you are
 * here to add a stock write, the requirement says you are wrong.
 */

export type CreateAlterationResult =
  | { ok: true; alterationId: string; alterationNo: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    fieldErrors[issue.path.join('.')] ??= issue.message;
  }
  return fieldErrors;
}

/**
 * Takes a garment in and issues its deposit slip reference (A-FR-9.12,
 * A-FR-9.14).
 *
 * `alteration_no` comes from the column default (`next_reference('ALT')`)
 * rather than app code, so two tills cannot race for the same number.
 * `received_by` comes from the session, never the payload.
 */
export async function createAlteration(
  input: AlterationInput
): Promise<CreateAlterationResult> {
  const parsed = alterationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const alteration = parsed.data;

  const { data, error } = await supabase
    .from('alterations')
    .insert({
      customer_name: alteration.customerName,
      student_name: alteration.studentName,
      class_level: alteration.classLevel,
      phone: alteration.phone,
      garment: alteration.garment,
      size: alteration.size,
      work_required: alteration.workRequired,
      expected_ready_date: alteration.expectedReadyDate,
      charge: alteration.charge,
      // Payment at intake is optional. When it is not taken now, both columns
      // stay null and the slip prints the charge as due on return.
      payment_method: alteration.paidNow ? alteration.paymentMethod : null,
      paid_at: alteration.paidNow ? new Date().toISOString() : null,
      notes: alteration.notes,
      received_by: user.id
    })
    .select('id, alteration_no')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'insertFailed' };

  revalidatePath('/alterations', 'page');
  return { ok: true, alterationId: data.id, alterationNo: data.alteration_no };
}

// ------------------------------------------------------------ transitions

export type AlterationTransitionResult =
  | { ok: true; status: AlterationStatus }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function currentStatus(alterationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('alterations')
    .select('id, status, charge, paid_at')
    .eq('id', alterationId)
    .single();
  if (error || !data) return null;
  return data;
}

/** One step forward (A-FR-9.13). One tap, no reason. */
export async function advanceAlteration(
  input: AdvanceAlterationInput
): Promise<AlterationTransitionResult> {
  const parsed = advanceAlterationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const row = await currentStatus(parsed.data.alterationId);
  if (!row) return { ok: false, error: 'notFound' };

  const target = nextStatus(row.status);
  if (!target) return { ok: false, error: 'noForwardStep' };

  const supabase = await createClient();
  // The reason belonged to the move that required it; leaving it behind would
  // attach a step-back's explanation to a later, unrelated status.
  const { error } = await supabase
    .from('alterations')
    .update({ status: target, status_reason: null })
    .eq('id', parsed.data.alterationId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/alterations', 'page');
  return { ok: true, status: target };
}

/** One step back, with a mandatory reason. */
export async function revertAlteration(
  input: RevertAlterationInput
): Promise<AlterationTransitionResult> {
  const parsed = revertAlterationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const row = await currentStatus(parsed.data.alterationId);
  if (!row) return { ok: false, error: 'notFound' };

  const target = previousStatus(row.status);
  if (!target) return { ok: false, error: 'noBackStep' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('alterations')
    .update({ status: target, status_reason: parsed.data.reason })
    .eq('id', parsed.data.alterationId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/alterations', 'page');
  return { ok: true, status: target };
}

/**
 * Cancels an alteration, with a mandatory reason.
 *
 * No refund handling here even when the charge was paid at intake: the garment
 * is the parent's own property and goes back regardless, so a cancellation is
 * about the work not happening rather than about goods changing hands. Refunds
 * for alterations are not in this issue's scope.
 */
export async function cancelAlteration(
  input: CancelAlterationInput
): Promise<AlterationTransitionResult> {
  const parsed = cancelAlterationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('alterations')
    .update({
      status: 'cancelled' as AlterationStatus,
      status_reason: parsed.data.reason
    })
    .eq('id', parsed.data.alterationId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/alterations', 'page');
  return { ok: true, status: 'cancelled' };
}

/**
 * Records payment on an alteration that was not paid at intake.
 *
 * Kept separate from the status workflow on purpose: the shop takes the money
 * at intake sometimes and on return other times, so payment is its own event
 * rather than a step. `paid_at` is what every other screen reads to decide
 * whether anything is still due.
 */
export async function payAlteration(
  input: PayAlterationInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = payAlterationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const row = await currentStatus(parsed.data.alterationId);
  if (!row) return { ok: false, error: 'notFound' };
  if (row.charge <= 0) return { ok: false, error: 'nothingToPay' };
  if (row.paid_at) return { ok: false, error: 'alreadyPaid' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('alterations')
    .update({
      payment_method: parsed.data.paymentMethod,
      paid_at: new Date().toISOString()
    })
    .eq('id', parsed.data.alterationId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/alterations', 'page');
  return { ok: true };
}

// ------------------------------------------------------------------ queries

/** Newest first, for the list beside the intake form. */
export async function listAlterations(limit = 25) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('alterations')
    .select(
      `id, alteration_no, received_at, expected_ready_date, status, customer_name,
       student_name, class_level, garment, size, charge, paid_at`
    )
    .order('received_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** One alteration, for the detail page and the deposit slip. */
export async function getAlteration(alterationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('alterations')
    .select(
      `id, alteration_no, received_at, expected_ready_date, status, status_reason,
       customer_name, student_name, class_level, phone, garment, size,
       work_required, charge, payment_method, paid_at, notes, returned_at,
       receivedBy:profiles!alterations_received_by_fkey ( full_name )`
    )
    .eq('id', alterationId)
    .single();
  return data;
}
