/**
 * Supabase Auth's redirect allow list (`uri_allow_list` in the Management
 * API's auth config), for scripts/auth-config.mjs. Pure, so the merge the
 * script PATCHes is tested without a network (allow-list.test.mjs).
 *
 * Supabase stores the list as one comma separated string. Adding the
 * production site must never drop what is already there (localhost, the
 * LAN address, staging), so the merge keeps every entry in its order and
 * only appends.
 */

/** The entries of a stored list: trimmed, empty pieces dropped. An array is read as one too. */
export function allowListEntries(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * The list with `entry` appended, or `current` itself (same value, so a
 * compare finds nothing to change) when the entry is already there. The
 * answer keeps the stored shape: a string for a string, an array for an
 * array; a missing list becomes a string.
 */
export function mergeAllowList(current, entry) {
  const entries = allowListEntries(current);
  if (entries.includes(entry)) return current;
  const merged = [...entries, entry];
  return Array.isArray(current) ? merged : merged.join(",");
}
