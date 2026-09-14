/**
 * The calendar date at the firm's desk. A deed says which day it was signed
 * in Lisbon and a passport is valid "today or later" by the same clock, so
 * both read the date here rather than from the server's own time zone,
 * which on a managed host is UTC and one hour behind Lisbon all summer.
 *
 * Intl is used for the time zone shift only, with numeric parts, so no
 * locale can change what comes back. Node ships full ICU since 13.
 */

export const FIRM_TIME_ZONE = "Europe/Lisbon";

export type CalendarDate = { year: number; month: number; day: number };

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: FIRM_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** The year, month (1 to 12) and day of `date` as seen in Lisbon. */
export function lisbonCalendarDate(date: Date): CalendarDate {
  const found = { year: 0, month: 0, day: 0 };
  for (const part of parts.formatToParts(date)) {
    if (part.type === "year" || part.type === "month" || part.type === "day") {
      found[part.type] = Number(part.value);
    }
  }
  return found;
}

/** `YYYY-MM-DD` for `date` as seen in Lisbon, the shape the database and the forms use. */
export function lisbonIsoDate(date: Date = new Date()): string {
  const { year, month, day } = lisbonCalendarDate(date);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
