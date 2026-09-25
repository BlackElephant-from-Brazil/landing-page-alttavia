import type { UserRow } from "@/lib/db/types";
import { ADMIN_ORDER_NOTE, createOrder } from "@/lib/orders/create";
import { recordManualPayment } from "@/lib/orders/manual-payment";
import { holdsLiveKey } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { INVALID_BODY, audit, errorResponse, isUuid, readJson, refuse, requestOrigin } from "../../../_lib/http";

/**
 * POST /api/admin/users/[id]/orders, body `{ serviceSlug, paidOutside? }`:
 * an order an admin places for a client. Contract
 * (docs/admin-contract.md) section 6, "Users".
 *
 * The order is built exactly as POST /api/orders builds it for a client who
 * buys from the gallery (src/lib/orders/create.ts), so the price, the
 * applicants and the first stage come from the service row and never from
 * the request. Only the event note differs: "Order created by the admin",
 * signed with the admin's id. The client then sees it on their dashboard
 * with a Pay button.
 *
 * `paidOutside` is for money that did not come through Stripe, a transfer
 * say: the order is marked paid with no Stripe ids and moved to the
 * service's second stage (src/lib/orders/manual-payment.ts), and the client
 * gets the same "Payment received" email a card payment sends. The event
 * notes whether this deploy holds a live Stripe key, so a payment recorded
 * on staging never counts as real money on production, which shares the
 * database (src/lib/orders/live-payment.ts).
 *
 * Answers `{ userServiceId, paid, emailed }`. 404 for an unknown client or
 * service, 403 for an administrator account, 400 for a body with no
 * service.
 */

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();

    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, "This user is not on record.");

    const body = await readJson(request);
    if (!body) return refuse(400, INVALID_BODY);
    const paidOutside = body.paidOutside === true;

    const db = createAdminClient();

    const { data, error } = await db.from("users").select("id, email, role").eq("id", id).maybeSingle();
    if (error) throw new Error(`users: ${error.message}`);
    const client = data as Pick<UserRow, "id" | "email" | "role"> | null;
    if (!client) return refuse(404, "This user is not on record.");
    if (client.role === "admin") return refuse(403, "Assign a purchase to a client account.");

    const { order, service } = await createOrder(db, {
      userId: id,
      serviceSlug: typeof body.serviceSlug === "string" ? body.serviceSlug : "",
      actorId: admin.id,
      note: ADMIN_ORDER_NOTE,
    });
    audit(admin, "user.order.create", order.id, `${client.email} ${service.slug}`);

    let paid = false;
    let emailed = false;
    if (paidOutside) {
      const payment = await recordManualPayment(db, order.id, admin.id, holdsLiveKey());
      paid = payment.changed;
      // The line says what happened, not what was asked for: recordManualPayment
      // answers `changed: false` when the order was already paid, and the audit
      // trail must not read as if money had been recorded twice.
      audit(
        admin,
        "user.order.paid_outside",
        order.id,
        `${client.email} ${service.slug} ${payment.changed ? "recorded" : "already paid"}`,
      );
      if (payment.changed) {
        try {
          // Loaded here rather than imported at the top, for the reason
          // src/lib/stripe/confirm.ts gives: the email code (and everything
          // it pulls in) stays out of this route's static import graph, and
          // a failed send can never undo an order that is already paid.
          const { notifyOrderPaid } = await import("@/lib/orders/notify");
          const sent = await notifyOrderPaid(
            { id: order.id, user_id: id, service_id: service.id, total_cents: order.total_cents, currency: order.currency },
            { db, origin: requestOrigin(request) },
          );
          emailed = sent.client;
        } catch (err) {
          console.error(`POST /api/admin/users/${id}/orders: payment emails for ${order.id} failed:`, err);
        }
      }
    }

    return Response.json({ userServiceId: order.id, paid, emailed });
  } catch (error) {
    return errorResponse(error);
  }
}
