import { resolveNote } from "@/lib/orders/notes";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { audit, errorResponse, isUuid, refuse } from "../../../_lib/http";

/**
 * POST /api/admin/notes/[id]/resolve, no body. Contract section 6. Sets
 * `resolved_at` and answers `{ note }`; a note already resolved comes back
 * as it is.
 */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();

    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, "Note not found.");

    const note = await resolveNote(id);
    audit(admin, "note.resolve", id);
    return Response.json({ note });
  } catch (error) {
    return errorResponse(error);
  }
}
