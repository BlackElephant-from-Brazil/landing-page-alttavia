import { MAX_DELIVERABLE_LABEL_LENGTH, createDeliverableUpload } from "@/lib/orders/deliverables";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { INVALID_BODY, audit, errorResponse, isUuid, readJson, refuse } from "../../_lib/http";

/**
 * POST /api/admin/deliverables/upload-url, body
 * `{ userServiceId, label, serviceDeliverableId?, fileName, mimeType, sizeBytes }`.
 * Contract section 6.
 *
 * Step one of returning a file to the client: a `pending` row and a
 * presigned PUT good for five minutes. Answers
 * `{ deliverableId, url, key, expiresIn }`. Step two is /confirm.
 */

const MAX_FILE_NAME_INPUT = 500;

type Body = {
  userServiceId: string;
  label: string;
  serviceDeliverableId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

function parseBody(b: Record<string, unknown>): Body | null {
  if (!isUuid(b.userServiceId)) return null;
  const label = typeof b.label === "string" ? b.label.trim() : b.label === undefined ? "" : null;
  if (label === null || label.length > MAX_DELIVERABLE_LABEL_LENGTH) return null;
  let serviceDeliverableId: string | null = null;
  if (b.serviceDeliverableId !== undefined && b.serviceDeliverableId !== null && b.serviceDeliverableId !== "") {
    if (!isUuid(b.serviceDeliverableId)) return null;
    serviceDeliverableId = b.serviceDeliverableId;
  }
  const fileName = typeof b.fileName === "string" ? b.fileName.trim() : "";
  const mimeType = typeof b.mimeType === "string" ? b.mimeType.trim().toLowerCase() : "";
  if (!fileName || fileName.length > MAX_FILE_NAME_INPUT || !mimeType) return null;
  const sizeBytes = b.sizeBytes;
  if (typeof sizeBytes !== "number" || !Number.isInteger(sizeBytes) || sizeBytes <= 0) return null;
  return { userServiceId: b.userServiceId, label, serviceDeliverableId, fileName, mimeType, sizeBytes };
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    const raw = await readJson(request);
    const body = raw ? parseBody(raw) : null;
    if (!body) return refuse(400, INVALID_BODY);

    const result = await createDeliverableUpload({ ...body, actorId: admin.id });
    audit(admin, "deliverable.create", result.deliverableId, `order ${body.userServiceId}`);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
