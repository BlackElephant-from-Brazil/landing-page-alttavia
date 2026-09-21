import type { AdminOrderRow, UserRow, ServiceRow } from "@/lib/db/types";
import { sendEmail } from "@/lib/email/send";
import { dashboardUrl, orderCompleted } from "@/lib/email/templates";
import { StageError, advanceStage, type StageMove } from "@/lib/orders/lifecycle";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { INVALID_BODY, audit, errorResponse, isUuid, readJson, refuse, requestOrigin } from "../../../_lib/http";

/**
 * POST /api/admin/orders/[id]/stage, body `{ direction: "forward" | "back" }`
 * or `{ stageKey }`. Contract sections 2 and 6.
 *
 * Answers `{ stageKey, completed, emailed?, warning? }`. The move itself is
 * advanceStage's; this handler adds the two things around it: the warning
 * when the order leaves `documents` with required documents still not
 * approved (the move still happens, by decision), and the "all done" email
 * to the order's owner.
 *
 * That email goes out only when advanceStage says `firstCompletion`: the
 * move reached the terminal stage and no earlier `user_service_events` row
 * had. Back to an earlier stage and forward again, or a jump to the terminal
 * stage after that, completes the order without a second email. `emailed`
 * is in the answer only when the email was due: true when it went out,
 * false when it did not (best effort, the move stands either way). Its
 * absence tells the modal to say nothing about an email.
 */

const STAGE_KEY = /^[a-z][a-z0-9_]{0,39}$/;
const DOCUMENTS_STAGE = "documents";

type Summary = Pick<AdminOrderRow, "id" | "user_id" | "stage_key" | "docs_required" | "docs_approved">;

function parseMove(body: Record<string, unknown>): StageMove | null {
  if (body.direction === "forward" || body.direction === "back") return { direction: body.direction };
  if (typeof body.stageKey === "string" && STAGE_KEY.test(body.stageKey)) return { stageKey: body.stageKey };
  return null;
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();

    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, "Order not found.");

    const body = await readJson(request);
    const move = body ? parseMove(body) : null;
    if (!move) return refuse(400, INVALID_BODY);

    const db = createAdminClient();
    const { data: beforeData, error: beforeError } = await db
      .from("admin_order_summary")
      .select("id, user_id, stage_key, docs_required, docs_approved")
      .eq("id", id)
      .maybeSingle();
    if (beforeError) throw new Error(`admin_order_summary: ${beforeError.message}`);
    const before = beforeData as Summary | null;
    if (!before) return refuse(404, "Order not found.");

    let result;
    try {
      result = await advanceStage(id, admin.id, move);
    } catch (error) {
      if (error instanceof StageError) return refuse(error.status, error.message);
      throw error;
    }
    const moved = result.stageKey !== before.stage_key;
    audit(admin, "order.stage", id, `${before.stage_key} -> ${result.stageKey}`);

    let warning: string | undefined;
    if (moved && before.stage_key === DOCUMENTS_STAGE && before.docs_approved < before.docs_required) {
      warning = `Moved on with ${before.docs_approved} of ${before.docs_required} required documents approved.`;
    }

    let emailed: boolean | undefined;
    if (result.firstCompletion) {
      // The order is already complete: nothing past this point may turn the answer into a 500.
      emailed = await emailCompleted(db, before.user_id, id, requestOrigin(request)).catch((error: unknown) => {
        console.error(`stage route: completion email failed for ${id}: ${error instanceof Error ? error.message : "unknown error"}`);
        return false;
      });
    }

    return Response.json({
      stageKey: result.stageKey,
      completed: result.completed,
      ...(emailed === undefined ? {} : { emailed }),
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Best effort, like every email here: a failure is logged and never fails
 * the move. True when Resend accepted the message, false otherwise (lookup
 * failed, no address on the profile, or the send itself failed).
 */
async function emailCompleted(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  orderId: string,
  origin: string,
): Promise<boolean> {
  const [userResult, orderResult] = await Promise.all([
    db.from("users").select("email").eq("id", userId).maybeSingle(),
    db.from("user_services").select("services(name)").eq("id", orderId).maybeSingle(),
  ]);
  if (userResult.error || orderResult.error) {
    console.error(`stage route: owner lookup failed for ${orderId}`);
    return false;
  }
  const email = (userResult.data as Pick<UserRow, "email"> | null)?.email;
  const service = (orderResult.data as { services: Pick<ServiceRow, "name"> | null } | null)?.services;
  if (!email) {
    console.error(`stage route: no email on record for the owner of ${orderId}; completion email not sent`);
    return false;
  }
  const content = orderCompleted({
    serviceName: service?.name ?? "service",
    dashboardUrl: dashboardUrl(origin, `/en/dashboard/orders/${orderId}`),
  });
  const { ok } = await sendEmail({ to: email, ...content });
  return ok;
}
