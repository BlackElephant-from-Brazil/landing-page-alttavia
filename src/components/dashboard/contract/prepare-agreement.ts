import type { ApplicantIndex } from "@/lib/contracts/state";

/**
 * Asking for the agreement from the card itself, and the tab it opens in.
 *
 * The one person agreement is asked for by the details dialog
 * (documents/applicant-details-form.tsx, `purpose: "contract"`), which saves
 * applicant 0 and POSTs the route in one submit. The Couple package's
 * agreement names two people, so the card walks the two details dialogs
 * first and asks for the agreement with a button of its own once both are
 * saved (contract-gate.tsx). That button needs what the dialog does: a blank
 * tab opened inside the click, before any await, so no popup blocker steps
 * in; the POST; the tab pointed at the agreement or closed on a refusal.
 *
 * The route answers 409 `{ error: "details_missing", applicant: 0 | 1 }`
 * when a person the agreement names has no details on the order; the card
 * opens that person's dialog rather than show the code. Anything else it
 * refuses with arrives as `{ error: "one line" }` and is shown as it is.
 */

export type PrepareAnswer =
  | { kind: "ready" }
  | { kind: "details"; applicant: ApplicantIndex }
  | { kind: "refused"; message: string };

/** The route's code for missing details, which is not a sentence to show. */
const DETAILS_MISSING = "details_missing";

export const PREPARE_GENERIC = "Something did not work. Try again.";

const tabCopy = {
  title: "Your service agreement",
  body: "Preparing your service agreement. It opens here in a moment.",
} as const;

/** The route's answer, read. `data` is the parsed JSON body, or null when there was none. */
export function readPrepareAnswer(response: { ok: boolean; status: number }, data: unknown): PrepareAnswer {
  if (response.ok) return { kind: "ready" };
  const body = data && typeof data === "object" ? (data as { error?: unknown; applicant?: unknown }) : null;
  if (response.status === 409 && body?.error === DETAILS_MISSING) {
    // An answer from before the route named the person meant applicant 0, the only one it knew.
    return { kind: "details", applicant: body.applicant === 1 ? 1 : 0 };
  }
  const message = typeof body?.error === "string" && body.error !== DETAILS_MISSING ? body.error : PREPARE_GENERIC;
  return { kind: "refused", message };
}

type Post = (input: string, init: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

/** POSTs /api/orders/[id]/contract with the optional place, as the details dialog does. Never throws. */
export async function requestAgreement(orderId: string, signingPlace: string, post: Post = fetch): Promise<PrepareAnswer> {
  let response: Awaited<ReturnType<Post>>;
  try {
    response = await post(`/api/orders/${orderId}/contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signingPlace: signingPlace.trim() }),
    });
  } catch {
    return { kind: "refused", message: PREPARE_GENERIC };
  }
  const data: unknown = await response.json().catch(() => null);
  return readPrepareAnswer(response, data);
}

/**
 * The blank tab the agreement lands in, opened while the click is still the
 * browser's user gesture; null when the browser refused it. It forgets who
 * opened it and says what it is waiting for, since preparing the PDF takes a
 * few seconds.
 */
export function openPendingTab(): Window | null {
  let tab: Window | null = null;
  try {
    tab = window.open("", "_blank");
  } catch {
    return null;
  }
  if (!tab) return null;
  try {
    tab.opener = null;
    tab.document.title = tabCopy.title;
    tab.document.body.style.cssText = "margin:3rem;font:1rem/1.6 Georgia,serif;color:#0E2A47;background:#FAFAF7";
    tab.document.body.textContent = tabCopy.body;
  } catch {
    // A tab that will not take the line still takes the agreement.
  }
  return tab;
}

export function closeTab(tab: Window | null): void {
  try {
    tab?.close();
  } catch {
    // Nothing to do: the tab is the browser's now.
  }
}

/** Points the waiting tab at the agreement. False when there is no tab to point: refused, or closed meanwhile. */
export function showAgreementIn(tab: Window | null, orderId: string): boolean {
  if (!tab || tab.closed) return false;
  try {
    tab.location.replace(new URL(`/api/orders/${orderId}/contract`, window.location.origin).href);
    return true;
  } catch {
    closeTab(tab);
    return false;
  }
}
