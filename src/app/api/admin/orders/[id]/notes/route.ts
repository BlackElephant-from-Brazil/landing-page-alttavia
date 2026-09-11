import type { NoteAudience } from "@/lib/db/types";
import { MAX_NOTE_LENGTH, addNote } from "@/lib/orders/notes";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { INVALID_BODY, audit, errorResponse, isUuid, readJson, refuse, requestOrigin } from "../../../_lib/http";

/**
 * POST /api/admin/orders/[id]/notes, body `{ body, audience? }`. Contract
 * section 6. `audience` defaults to `client`, which is a pendency and emails
 * the owner; `internal` is the firm's own note.
 *
 * Answers 201 `{ note, emailed }`.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();

    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, "Order not found.");

    const body = await readJson(request);
    if (!body) return refuse(400, INVALID_BODY);

    const audienceRaw = body.audience ?? "client";
    if (audienceRaw !== "client" && audienceRaw !== "internal") return refuse(400, INVALID_BODY);
    const audience = audienceRaw as NoteAudience;

    if (typeof body.body !== "string") return refuse(400, INVALID_BODY);
    const text = body.body.trim();
    if (!text || text.length > MAX_NOTE_LENGTH) {
      return refuse(422, `Write between 1 and ${MAX_NOTE_LENGTH} characters.`);
    }

    const result = await addNote(id, admin.id, audience, text, requestOrigin(request));
    audit(admin, `note.add.${audience}`, result.note.id, `order ${id}`);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
