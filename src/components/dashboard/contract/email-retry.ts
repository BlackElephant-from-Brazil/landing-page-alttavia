/**
 * The quiet second try of an agreement's email, from the client's side.
 *
 * An agreement whose email did not go out keeps `emailed_at` null, and the
 * route that prepares agreements sends the stored file again when it is
 * asked for one that already exists (ensureContract; the POST is idempotent
 * and generates nothing the second time). Nothing on the server calls it
 * again by itself, so the agreement's card does, once, when it mounts over
 * such a row.
 *
 * Never two requests for the same order at once, whoever asks: React's
 * StrictMode runs an effect twice on mount, and a modal can be closed and
 * opened again while the first request is still out. The set below is per
 * browser tab, which is the scope that matters here.
 */

const inFlight = new Set<string>();

type Post = (input: string, init: RequestInit) => Promise<Pick<Response, "ok">>;

/**
 * Asks the route to send the agreement again. True when it answered ok (the
 * caller then refreshes to read the new `emailed_at`); false when a request
 * for this order is already out, when the route refused and when the network
 * failed. Silent by design: the card shows nothing of this.
 */
export async function retryAgreementEmail(orderId: string, post: Post = fetch): Promise<boolean> {
  if (inFlight.has(orderId)) return false;
  inFlight.add(orderId);
  try {
    const response = await post(`/api/orders/${orderId}/contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    inFlight.delete(orderId);
  }
}
