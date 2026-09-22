import { GENERIC_ERROR, RequestError } from "../lib/request";

/**
 * A GET to an admin route, for the one place a dialog has to read something
 * before it can ask its question: the delete dialog, which shows what is
 * stored under the account before the admin types the email.
 *
 * Everything else in the admin writes, and writes go through `requestJson`
 * in ../lib/request, which only speaks POST, PATCH and DELETE. This is the
 * same contract read only: the route's `{ error }` line on failure, the
 * generic line when there is no body to read.
 */
export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: "GET", headers: { Accept: "application/json" }, signal });
  } catch (error) {
    // An aborted request is the caller unmounting, not a failure to show.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new RequestError(0, GENERIC_ERROR);
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const line =
      data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error.trim()
        : "";
    throw new RequestError(response.status, line || GENERIC_ERROR);
  }
  return data as T;
}
