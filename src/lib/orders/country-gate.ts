import { blockedCountriesIn } from "@/lib/apply/rules";
import { sanitizeAnswers } from "@/lib/apply/storage";
import type { Db } from "@/lib/db/queries";

/**
 * The owner's country block list (BLOCKED_COUNTRIES in
 * src/lib/apply/rules.ts) for an order placed without the application form:
 * POST /api/orders, the purchase drawer of the client area.
 *
 * The drawer asks no country, and /en/login opens an account for any new
 * email, so without this a visitor stopped by the form could sign in there
 * and buy from the dashboard. The account's own application decides instead:
 * every order POST /api/apply/submit wrote (a `submission_id` and its
 * `answers_snapshot`, which that route checked against the list).
 *
 *   "ok"           at least one application, and none names a blocked country
 *   "blocked"      an application names a blocked address or passport
 *   "apply_first"  the account never sent the form, so nothing was checked
 *
 * The admin's own route (POST /api/admin/users/[id]/orders) does not ask:
 * the firm places those orders knowing the client.
 */
export type CountryGate = "ok" | "blocked" | "apply_first";

/** Pure: the gate for the answers of every application the account sent. */
export function countryGateFor(snapshots: readonly unknown[]): CountryGate {
  if (snapshots.length === 0) return "apply_first";
  for (const snapshot of snapshots) {
    if (blockedCountriesIn(sanitizeAnswers(snapshot)).length > 0) return "blocked";
  }
  return "ok";
}

/** Reads the account's applications with the admin client the caller passes in. */
export async function loadCountryGate(admin: Db, userId: string): Promise<CountryGate> {
  const { data, error } = await admin
    .from("user_services")
    .select("answers_snapshot")
    .eq("user_id", userId)
    .not("submission_id", "is", null);
  if (error) throw new Error(`loadCountryGate: ${error.message}`);
  const rows = (data ?? []) as { answers_snapshot: unknown }[];
  return countryGateFor(rows.map((row) => row.answers_snapshot));
}
