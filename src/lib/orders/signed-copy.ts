/**
 * When a client's signed service agreement goes to the team inbox
 * (notifySignedAgreement in src/lib/orders/notify.ts), as a pure rule.
 *
 *   signedCopyDue(sentAt, rejectedAt)               -> this round is still open, or not
 *   signedCopyClaimWins(claims, rejectedAt, mine)   -> of the calls that claimed the round, this one sends
 *   SIGNED_COPY_SENT_NOTE                           -> the note of the event that claims, then records, a send
 *
 * Patrícia wants the copy signed by both parties in her inbox (answer of
 * 2026-09-24), and each email carries a file of up to 8 MB. Sent on every
 * confirmed upload, a client could loop upload, replace or remove, upload,
 * while the order sits on the documents stage and post the firm one large
 * email per turn, through the same sending account as the login codes
 * (review of 2026-09-25). So the copy goes once per review round:
 *
 *   - the first signed copy the order ever confirms is sent;
 *   - after that, another one is sent only when the firm has rejected a
 *     signed copy of this order since the last one went out, which is the
 *     firm asking for a new copy. The firm decides how often, never the
 *     client;
 *   - a copy that replaces one still waiting for review, or follows one the
 *     client removed, is not sent: the firm already has a copy of this round
 *     in its inbox, and the order holds the newest one. Approving it happens
 *     in /admin, where the file in the slot is what the admin sees.
 *
 * What was sent is remembered as a `user_service_events` row on the order's
 * current stage (from and to the same, like the review events of
 * src/lib/orders/review.ts) whose note is SIGNED_COPY_SENT_NOTE. The admin's
 * order history shows it, which is also where the firm sees when a copy
 * reached the inbox.
 *
 * The row is a claim first, then the record (review of 2026-09-25). Two
 * confirms close together (a copy, then its replacement while the first
 * email is still being read from the bucket or sent) used to both find the
 * round open and both send, because the row was written only after the
 * send. Now each call that finds the round open writes its row before
 * anything else, reads the order's rows again, and sends only when its own
 * row is the earliest of the round (signedCopyClaimWins); a call that lost
 * takes its row back and sends nothing. A call writes, then reads: of two
 * calls, the one that reads last sees both rows, and the one that read
 * first wrote first, so both agree on the winner. A send that fails takes
 * its row back too, so the next copy of the round is sent.
 *
 * `sentAt` holds the `created_at` of those events, `rejectedAt` the
 * `reviewed_at` of the order's rejected signed copies (null for a row that
 * somehow has none, which is ignored). Both are ISO timestamps in any order.
 */

export const SIGNED_COPY_SENT_NOTE = "Signed service agreement sent to the team inbox";

function latest(values: readonly (string | null | undefined)[]): number | null {
  let newest: number | null = null;
  for (const value of values) {
    if (!value) continue;
    const at = Date.parse(value);
    if (Number.isNaN(at)) continue;
    if (newest === null || at > newest) newest = at;
  }
  return newest;
}

export function signedCopyDue(
  sentAt: readonly (string | null | undefined)[],
  rejectedAt: readonly (string | null | undefined)[],
): boolean {
  const lastSent = latest(sentAt);
  if (lastSent === null) return true;
  const lastRejected = latest(rejectedAt);
  return lastRejected !== null && lastRejected > lastSent;
}

/** One SIGNED_COPY_SENT_NOTE row of the order: its id and when it was written. */
export type SignedCopyClaim = { id: string; created_at?: string | null };

/**
 * True when `mine` is the claim this round's email belongs to: the earliest
 * of the claims written since the firm's latest rejection (every claim, when
 * there is none), the smaller id first when two share a timestamp. A claim
 * written at the very moment of the rejection belongs to the new round, as
 * signedCopyDue counts it. A claim whose time cannot be read never wins.
 */
export function signedCopyClaimWins(
  claims: readonly SignedCopyClaim[],
  rejectedAt: readonly (string | null | undefined)[],
  mine: string,
): boolean {
  const lastRejected = latest(rejectedAt);
  const round = claims
    .map((claim) => ({ id: claim.id, at: claim.created_at ? Date.parse(claim.created_at) : Number.NaN }))
    .filter((claim) => !Number.isNaN(claim.at) && (lastRejected === null || claim.at >= lastRejected))
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return round[0]?.id === mine;
}
