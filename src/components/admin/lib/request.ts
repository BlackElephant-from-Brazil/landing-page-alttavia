/**
 * The one way an admin action talks to /api/admin/*. Browser only (no
 * `server-only`, no environment); the action components import it.
 *
 * Every route answers `{ error: "one line" }` on failure, so that line is
 * what the caller shows. A network failure or an answer with no body gets
 * the generic line instead. Nothing from a provider ever reaches here: the
 * routes already keep those out.
 */

export const GENERIC_ERROR = "Something did not work. Try again.";

export class RequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorLine(data: unknown): string | null {
  if (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string") {
    const line = (data as { error: string }).error.trim();
    return line || null;
  }
  return null;
}

/** Sends JSON (or nothing) and returns the parsed reply, or throws a RequestError with the route's line. */
export async function requestJson<T = unknown>(
  path: string,
  init: { method: "POST" | "PATCH" | "DELETE"; body?: unknown } = { method: "POST" },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method,
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new RequestError(0, GENERIC_ERROR);
  }
  const data = await readJson(response);
  if (!response.ok) throw new RequestError(response.status, errorLine(data) ?? GENERIC_ERROR);
  return data as T;
}

/** The message to show for anything thrown around requestJson. */
export function messageFor(error: unknown): string {
  return error instanceof Error && error.message ? error.message : GENERIC_ERROR;
}
