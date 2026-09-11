/**
 * Search params on the admin pages, as the pages receive them (a plain
 * object whose values may repeat) and as links need them (a query string
 * with one key changed and the rest kept).
 *
 * Every filter lives in the URL on purpose: a refresh, the back button and
 * a shared link all reopen the same view, and the order modal is one more
 * key (`order`) on top of whatever filters are set.
 */

export type SearchParams = Record<string, string | string[] | undefined>;

/** The first value of a key, trimmed, or undefined when absent or blank. */
export function firstParam(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  const one = Array.isArray(value) ? value[0] : value;
  const trimmed = one?.trim();
  return trimmed ? trimmed : undefined;
}

/** A positive integer from a param, else the fallback. */
export function intParam(params: SearchParams, key: string, fallback: number): number {
  const raw = firstParam(params, key);
  if (!raw || !/^\d{1,6}$/.test(raw)) return fallback;
  const value = Number(raw);
  return value >= 1 ? value : fallback;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/**
 * `pathname` plus the current params with `patch` applied: a string sets a
 * key, null removes it. Keys with repeated values keep their first value.
 */
export function hrefWith(pathname: string, params: SearchParams, patch: Record<string, string | null>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const one = Array.isArray(value) ? value[0] : value;
    if (one !== undefined && one !== "") query.set(key, one);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) query.delete(key);
    else query.set(key, value);
  }
  const string = query.toString();
  return string ? `${pathname}?${string}` : pathname;
}
