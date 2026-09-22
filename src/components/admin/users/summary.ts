import type { AdminUserCounts } from "@/lib/db/types";

/**
 * What the delete dialog says goes with an account: "3 orders, 14 files and
 * 1 agreement". Pure, so the wording is tested rather than read off a
 * screen.
 *
 * Only what is there is listed, and nothing is listed as zero: an account
 * with no orders reads "Nothing is stored for this account yet." Agreements
 * are named on their own although they are counted in `files` too, because
 * an agreement is the one file the firm signed and sent.
 */

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "a, b and c" from the pieces that are worth saying. */
export function joinParts(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export const NOTHING_STORED = "Nothing is stored for this account yet.";

export function describeDeletion(counts: AdminUserCounts): string {
  const entries: { count: number; text: string }[] = [
    { count: counts.orders, text: plural(counts.orders, "order", "orders") },
    { count: counts.files, text: plural(counts.files, "file", "files") },
    { count: counts.agreements, text: plural(counts.agreements, "agreement", "agreements") },
    { count: counts.answers, text: plural(counts.answers, "answer", "answers") },
  ].filter((entry) => entry.count > 0);

  if (entries.length === 0) return NOTHING_STORED;
  const singular = entries.length === 1 && entries[0].count === 1;
  return `${joinParts(entries.map((entry) => entry.text))} ${singular ? "goes" : "go"} with it.`;
}
