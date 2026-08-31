/**
 * Telling the seller what actually happened to a sale (A-NFR-3).
 *
 * "A sale that appears saved but is not is the worst possible failure mode."
 * The mirror is just as bad and is the one careless wording causes: a sale that
 * WAS saved, reported as failed, retried, and recorded twice. Real money, twice
 * over.
 *
 * So the three outcomes are kept distinct, and the uncertain one is allowed to
 * say it is uncertain rather than being flattened into "failed".
 */
export type SaveOutcome =
  /** The server confirmed the write. Only this may show a success. */
  | { state: 'saved'; reference: string; id: string }
  /**
   * The server answered, and the answer was no. Nothing was written, so a
   * retry is safe and the seller can be told so plainly.
   */
  | { state: 'rejected'; message: string }
  /**
   * No answer arrived. The write may or may not have happened -- the reply is
   * what went missing, not necessarily the sale. Claiming "not saved" here
   * would invite the duplicate.
   */
  | { state: 'unknown' };

/** How long to wait before deciding no answer is coming. */
export const SAVE_TIMEOUT_MS = 15_000;

/**
 * Runs a save with a deadline, mapping every ending onto one of the three
 * outcomes above.
 *
 * A thrown error and an expired deadline both land on 'unknown' rather than
 * 'rejected': a network error mid-flight tells us the reply failed, not that
 * the write did.
 */
export async function withSaveDeadline<T>(
  run: () => Promise<T>,
  timeoutMs: number = SAVE_TIMEOUT_MS
): Promise<{ ok: true; value: T } | { ok: false; reason: 'timeout' | 'threw'; error?: unknown }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  try {
    const outcome = await Promise.race([run(), deadline]);
    if (outcome === 'timeout') return { ok: false, reason: 'timeout' };
    return { ok: true, value: outcome as T };
  } catch (error) {
    return { ok: false, reason: 'threw', error };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Whether a failure message came from the database rather than from us.
 *
 * A seller should never read "new row violates check constraint". The raw text
 * still goes to the console for whoever debugs it; the screen gets a sentence
 * in their own language.
 */
