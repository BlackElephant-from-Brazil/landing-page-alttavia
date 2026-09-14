import { AdminAuthError, adminErrorResponse, type AdminUser } from "@/lib/supabase/admin-user";

/**
 * What every handler under /api/admin shares. Contract
 * (docs/admin-contract.md) sections 6 and 9.
 *
 * The folder starts with an underscore, so Next.js never routes to it.
 *
 * Shape of every answer: `{ error: "one line" }` with a status, or the
 * payload the contract names. Errors thrown by the order modules
 * (ReviewError, DeliverableError, ServiceError, StageError) all
 * carry a 4xx `status` and a message written under the house rules, so
 * errorResponse() passes them through as they are; anything else becomes a
 * logged 500 with a generic line, through adminErrorResponse().
 */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const INVALID_BODY = "Check the details and try again.";

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function refuse(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/** The JSON body as an object, or null when it is missing, malformed or not an object. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    return raw as Record<string, unknown>;
  } catch {
    return null;
  }
}

type ActionError = Error & { status: number };

/** An error one of the order modules threw on purpose: a 4xx with a message the admin may read. */
function isActionError(error: unknown): error is ActionError {
  if (!(error instanceof Error)) return false;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && status >= 400 && status < 500;
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AdminAuthError) return adminErrorResponse(error);
  if (isActionError(error)) return refuse(error.status, error.message);
  return adminErrorResponse(error);
}

/**
 * One line in the server log per download and per write: who did what to
 * which row. The audit trail the contract asks for.
 */
export function audit(admin: Pick<AdminUser, "id">, action: string, target: string, detail?: string): void {
  console.info(`[admin] ${admin.id} ${action} ${target}${detail ? ` ${detail}` : ""}`);
}

/** The origin links inside emails are built on: the site URL when set, else where the request came from. */
export function requestOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin") || new URL(request.url).origin;
}
