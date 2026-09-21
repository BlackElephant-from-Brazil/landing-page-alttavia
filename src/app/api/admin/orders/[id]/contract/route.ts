import { regenerateContract } from "@/lib/contracts/ensure";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { audit, errorResponse, isUuid, refuse, requestOrigin } from "../../../_lib/http";

/**
 * POST /api/admin/orders/[id]/contract, no body. Design
 * (docs/agreement-contract.md) sections 5 and 7: "Regenerate and resend".
 *
 * Prepares the order's service agreement again from the client's details as
 * they are now, as a new version under a new key, and emails it to the
 * client again. An order with no agreement yet gets its first version.
 * Answers `{ contract, emailed }`: the row after the write and whether the
 * email went out.
 *
 * regenerateContract's own errors pass through as they are: 404 for an
 * unknown order or a service with no contract, 409 "Payment first.", 409
 * when the client has not entered their details, 409 when two regenerations
 * race each other. The download is GET /api/orders/[id]/contract, which an
 * admin may open too.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();

    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, "Order not found.");

    const result = await regenerateContract(createAdminClient(), id, { origin: requestOrigin(request) });
    audit(admin, "contract.regenerate", id, `v${result.contract.version}${result.emailed ? " emailed" : ""}`);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
