/**
 * Formatting for the admin screens. Pure, shared by server and client
 * components and by the tests.
 *
 * Dates read en-GB ("11 Sep 2026") in the firm's time zone, so a payment at
 * one in the morning in Lisbon is not shown on the day before. Money is
 * euros from cents through the same formatter the landing uses.
 */

import { formatBytes } from "@/lib/r2/keys";

export { formatEuro } from "@/content/bank-nif";

/** "2 MB", "340 KB": the file size next to a name. */
export function formatBytesShort(bytes: number): string {
  return formatBytes(bytes);
}

export const FIRM_TIME_ZONE = "Europe/Lisbon";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: FIRM_TIME_ZONE,
});

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: FIRM_TIME_ZONE,
});

const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const monthYearFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "11 Sep 2026", or the fallback when the value is null or unreadable. */
export function formatDate(value: string | null | undefined, fallback = ""): string {
  const date = parse(value);
  return date ? dateFormat.format(date) : fallback;
}

/** "11 Sep 2026, 14:05". */
export function formatDateTime(value: string | null | undefined, fallback = ""): string {
  const date = parse(value);
  return date ? dateTimeFormat.format(date) : fallback;
}

/** "Sep" for a `YYYY-MM` key. */
export function formatMonthShort(month: string): string {
  const date = parse(`${month}-01T00:00:00.000Z`);
  return date ? monthFormat.format(date) : month;
}

/** "September 2026" for a `YYYY-MM` key. */
export function formatMonthLong(month: string): string {
  const date = parse(`${month}-01T00:00:00.000Z`);
  return date ? monthYearFormat.format(date) : month;
}

/** "1,284" with a thousands separator, for counts in tiles and tables. */
export function formatCount(value: number): string {
  return value.toLocaleString("en-GB");
}

/** A stage key as a readable fallback label: "awaiting_bank" becomes "Awaiting bank". */
export function humanizeKey(key: string): string {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : key;
}
