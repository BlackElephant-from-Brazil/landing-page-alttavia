import { getServiceBySlug, type Db } from "@/lib/db/queries";
import type { ServiceRow, UserServiceRow } from "@/lib/db/types";

/**
 * Placing an order for a service, without the questions of the application
 * form. One place, two callers:
 *
 *   POST /api/orders                   the client, from the purchase drawer
 *   POST /api/admin/users/[id]/orders  an admin, for that client
 *
 * The browser names a service and nothing else. The price, the total, the
 * applicants and the stage are computed here from the service row, never
 * taken from the request, so neither caller can be talked into a cheaper
 * order. `answers_snapshot` is `{}`, which is how the order view knows to
 * hide the answers section.
 *
 * One unit per purchase (documents contract section 1): a second NIF is a
 * second order. `joint` is the couple package alone, the same rule as
 * `applicantsFor()` in src/lib/apply/recommend.ts.
 *
 * Writes with the admin client the caller passes in, after that caller has
 * checked the session: the `user_services` row at `awaiting_payment` and its
 * first `user_service_events` row, whose `note` and `actor_id` say who
 * placed it.
 *
 * Refusals are CreateOrderError with a status and a one line message the UI
 * can show as it is; a database failure throws a plain Error, which the
 * routes log and answer 500.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 64;

/** The event note each caller writes. */
export const CLIENT_ORDER_NOTE = "Ordered from the client area";
export const ADMIN_ORDER_NOTE = "Order created by the admin";

export type CreateOrderErrorCode = "invalid_slug" | "service_not_available";

export class CreateOrderError extends Error {
  readonly code: CreateOrderErrorCode;
  readonly status: 400 | 404;

  constructor(code: CreateOrderErrorCode, status: 400 | 404, message: string) {
    super(message);
    this.name = "CreateOrderError";
    this.code = code;
    this.status = status;
  }
}

/** A service slug from a request body, or null when it is not one. Pure. */
export function normalizeSlug(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const slug = raw.trim().toLowerCase();
  if (!slug || slug.length > MAX_SLUG_LENGTH || !SLUG.test(slug)) return null;
  return slug;
}

export type OrderShape = {
  /** The couple package alone: one order, two people, one joint account. */
  joint: boolean;
  applicants: 1 | 2;
  totalCents: number;
  currency: string;
};

/** What one unit of a service costs and covers. Pure. */
export function orderShapeFor(service: Pick<ServiceRow, "slug" | "price_cents" | "currency">): OrderShape {
  const joint = service.slug === "couple";
  return {
    joint,
    applicants: joint ? 2 : 1,
    totalCents: service.price_cents,
    currency: service.currency || "eur",
  };
}

export type CreateOrderInput = {
  /** The client the order belongs to. */
  userId: string;
  serviceSlug: string;
  /** Who placed it: the client themselves, or the admin who did it for them. */
  actorId: string | null;
  note: string;
};

export type CreatedOrder = { order: UserServiceRow; service: ServiceRow };

export async function createOrder(admin: Db, input: CreateOrderInput): Promise<CreatedOrder> {
  const slug = normalizeSlug(input.serviceSlug);
  if (!slug) throw new CreateOrderError("invalid_slug", 400, "Choose a service.");

  const service = await getServiceBySlug(admin, slug);
  if (!service || !service.active) {
    throw new CreateOrderError("service_not_available", 404, "That service is not available.");
  }

  const shape = orderShapeFor(service);

  const { data: created, error: orderError } = await admin
    .from("user_services")
    .insert({
      user_id: input.userId,
      service_id: service.id,
      submission_id: null,
      answers_snapshot: {},
      joint: shape.joint,
      applicants: shape.applicants,
      total_cents: shape.totalCents,
      currency: shape.currency,
      stage_key: "awaiting_payment",
    })
    .select("*")
    .single();
  if (orderError || !created) {
    throw new Error(`user_services: ${orderError?.message ?? "no row returned"}`);
  }
  const order = created as UserServiceRow;

  const { error: eventError } = await admin.from("user_service_events").insert({
    user_service_id: order.id,
    from_stage: null,
    to_stage: "awaiting_payment",
    note: input.note,
    actor_id: input.actorId,
  });
  if (eventError) {
    // The order exists and can be paid; the audit row is worth a log line.
    console.error(`createOrder: event insert failed for ${order.id}: ${eventError.message}`);
  }

  return { order, service };
}
