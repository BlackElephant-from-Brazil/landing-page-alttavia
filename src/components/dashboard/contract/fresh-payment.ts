/**
 * Whether an order was paid a moment ago, which is when the service
 * agreement's details dialog opens by itself (docs/agreement-contract.md
 * section 6). Pure, so contract-gate.tsx can call it from an effect and the
 * test can pin the edges.
 */

/** How long after the payment the details dialog still opens by itself. */
export const FRESH_PAYMENT_MS = 15 * 60 * 1000;

/**
 * True when `paidAt` is less than fifteen minutes from `nowMs`, on either
 * side. `paid_at` is stamped by the server and `nowMs` comes from the
 * browser, whose clock may run a little behind: a payment of two seconds ago
 * must not read as one from the future and keep the dialog shut. An unpaid
 * order and a date that does not parse are never fresh.
 */
export function isFreshPayment(paidAt: string | null | undefined, nowMs: number): boolean {
  if (!paidAt) return false;
  const paid = new Date(paidAt).getTime();
  if (Number.isNaN(paid)) return false;
  return Math.abs(nowMs - paid) < FRESH_PAYMENT_MS;
}
