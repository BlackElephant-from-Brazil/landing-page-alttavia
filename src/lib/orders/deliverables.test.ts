import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The deliverable upload pair against a fake admin client and a fake R2:
 * presignUpload answers a URL built from the key, headObjectSize answers
 * whatever the test says the bucket holds.
 */

const { tables, writes, presignUpload, headObjectSize } = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  writes: [] as { table: string; op: "update" | "insert"; payload: Record<string, unknown> }[],
  presignUpload: vi.fn(),
  headObjectSize: vi.fn(),
}));

vi.mock("@/lib/r2/client", () => ({ presignUpload, headObjectSize }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: [string, unknown][] = [];
      let op: "select" | "update" | "insert" = "select";
      let payload: Record<string, unknown> = {};
      const rows = () => (tables[table] ??= []);
      const matching = () => rows().filter((row) => filters.every(([c, v]) => row[c] === v));
      const run = () => {
        if (op === "update") {
          const hit = matching();
          for (const row of hit) Object.assign(row, payload);
          writes.push({ table, op, payload });
          return { data: hit.map((r) => ({ ...r })), error: null };
        }
        if (op === "insert") {
          const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...payload };
          rows().push(row);
          writes.push({ table, op, payload });
          return { data: [{ ...row }], error: null };
        }
        return { data: matching().map((r) => ({ ...r })), error: null };
      };
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        update(values: Record<string, unknown>) {
          op = "update";
          payload = values;
          return query;
        },
        insert(values: Record<string, unknown>) {
          op = "insert";
          payload = values;
          return query;
        },
        maybeSingle() {
          const r = run();
          return Promise.resolve({ data: r.data[0] ?? null, error: null });
        },
        single() {
          const r = run();
          return Promise.resolve(
            r.data[0] ? { data: r.data[0], error: null } : { data: null, error: { message: "no rows" } },
          );
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
  }),
}));

import {
  DELIVERABLE_MAX_BYTES,
  DeliverableError,
  buildDeliverableKey,
  confirmDeliverable,
  createDeliverableUpload,
} from "./deliverables";

const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const SERVICE_ID = "44444444-4444-4444-8444-444444444444";
const ADMIN_ID = "55555555-5555-4555-8555-555555555555";
const TEMPLATE_ID = "99999999-9999-4999-8999-999999999999";
const OTHER_TEMPLATE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DELIVERABLE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function upload(overrides: Partial<Parameters<typeof createDeliverableUpload>[0]> = {}) {
  return createDeliverableUpload({
    userServiceId: ORDER_ID,
    label: "NIF certificate",
    fileName: "nif.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    actorId: ADMIN_ID,
    ...overrides,
  });
}

beforeEach(() => {
  writes.length = 0;
  presignUpload.mockReset();
  presignUpload.mockImplementation(async ({ key }: { key: string }) => ({ url: `https://r2.example/${key}`, expiresIn: 300 }));
  headObjectSize.mockReset();
  for (const key of Object.keys(tables)) delete tables[key];
  tables.user_services = [{ id: ORDER_ID, service_id: SERVICE_ID, paid_at: "2026-09-10T09:00:00.000Z" }];
  tables.service_deliverables = [
    { id: TEMPLATE_ID, service_id: SERVICE_ID, label: "NIF certificate" },
    { id: OTHER_TEMPLATE_ID, service_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", label: "Account confirmation" },
  ];
  tables.user_service_deliverables = [];
});

describe("buildDeliverableKey", () => {
  it("follows deliverables/{order}/{uuid}.{ext}", () => {
    const parts = buildDeliverableKey(ORDER_ID, "pdf").split("/");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("deliverables");
    expect(parts[1]).toBe(ORDER_ID);
    const [name, ext] = parts[2].split(".");
    expect(name).toMatch(UUID);
    expect(ext).toBe("pdf");
  });

  it("refuses segments that could leave the folder", () => {
    expect(() => buildDeliverableKey("../x", "pdf")).toThrow();
    expect(() => buildDeliverableKey(ORDER_ID, "p/df")).toThrow();
  });
});

describe("createDeliverableUpload", () => {
  it("writes a pending row and presigns a PUT for the file it was told about", async () => {
    const result = await upload({ serviceDeliverableId: TEMPLATE_ID, fileName: "  my nif.pdf " });

    expect(result.key).toMatch(new RegExp(`^deliverables/${ORDER_ID}/[0-9a-f-]{36}\\.pdf$`));
    expect(result.url).toBe(`https://r2.example/${result.key}`);
    expect(result.expiresIn).toBe(300);
    expect(presignUpload).toHaveBeenCalledWith({ key: result.key, contentType: "application/pdf", contentLength: 2048 });

    const row = tables.user_service_deliverables[0];
    expect(row).toMatchObject({
      id: result.deliverableId,
      user_service_id: ORDER_ID,
      service_deliverable_id: TEMPLATE_ID,
      label: "NIF certificate",
      storage_key: result.key,
      status: "pending",
      file_name: "my nif.pdf",
      mime_type: "application/pdf",
      size_bytes: 2048,
      uploaded_by: ADMIN_ID,
    });
  });

  it("takes the template's label when none is given", async () => {
    await upload({ label: "  ", serviceDeliverableId: TEMPLATE_ID, mimeType: DOCX, fileName: "summary.docx" });

    expect(tables.user_service_deliverables[0]).toMatchObject({ label: "NIF certificate", mime_type: DOCX });
  });

  it("requires a label for a file outside the template", async () => {
    await expect(upload({ label: "" })).rejects.toMatchObject({ code: "label_required", status: 422 });
    expect(writes).toHaveLength(0);
  });

  it("refuses a file type outside PDF, JPG, PNG and DOCX", async () => {
    await expect(upload({ mimeType: "image/webp" })).rejects.toMatchObject({ code: "type_not_accepted", status: 415 });
    await expect(upload({ mimeType: "text/plain" })).rejects.toBeInstanceOf(DeliverableError);
    expect(presignUpload).not.toHaveBeenCalled();
  });

  it("refuses a file over 20 MB", async () => {
    await expect(upload({ sizeBytes: DELIVERABLE_MAX_BYTES + 1 })).rejects.toMatchObject({ code: "too_large", status: 413 });
    await expect(upload({ sizeBytes: DELIVERABLE_MAX_BYTES })).resolves.toBeTruthy();
  });

  it("answers 404 for an unknown order", async () => {
    await expect(upload({ userServiceId: "00000000-0000-4000-8000-000000000000" })).rejects.toMatchObject({
      code: "order_not_found",
      status: 404,
    });
  });

  it("refuses a file on an unpaid order", async () => {
    tables.user_services = [{ id: ORDER_ID, service_id: SERVICE_ID, paid_at: null }];

    await expect(upload()).rejects.toMatchObject({ code: "order_unpaid", status: 409, message: "Payment first." });
    expect(presignUpload).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("refuses a template that belongs to another service", async () => {
    await expect(upload({ serviceDeliverableId: OTHER_TEMPLATE_ID })).rejects.toMatchObject({
      code: "template_mismatch",
      status: 422,
    });
    expect(writes).toHaveLength(0);
  });
});

describe("confirmDeliverable", () => {
  function seed(status: "pending" | "ready" = "pending") {
    tables.user_service_deliverables = [
      {
        id: DELIVERABLE_ID,
        user_service_id: ORDER_ID,
        service_deliverable_id: TEMPLATE_ID,
        label: "NIF certificate",
        storage_key: `deliverables/${ORDER_ID}/abc.pdf`,
        status,
        file_name: "nif.pdf",
        mime_type: "application/pdf",
        size_bytes: 2048,
        uploaded_by: ADMIN_ID,
      },
    ];
  }

  it("flips the row to ready when the bucket holds an object of the right size", async () => {
    seed();
    headObjectSize.mockResolvedValue(2048);

    const row = await confirmDeliverable(DELIVERABLE_ID);

    expect(row.status).toBe("ready");
    expect(tables.user_service_deliverables[0].status).toBe("ready");
    expect(headObjectSize).toHaveBeenCalledWith(`deliverables/${ORDER_ID}/abc.pdf`);
  });

  it("keeps the row pending when the object is missing or a different size", async () => {
    seed();
    headObjectSize.mockResolvedValue(null);
    await expect(confirmDeliverable(DELIVERABLE_ID)).rejects.toMatchObject({ code: "upload_incomplete", status: 422 });

    headObjectSize.mockResolvedValue(10);
    await expect(confirmDeliverable(DELIVERABLE_ID)).rejects.toMatchObject({ code: "upload_incomplete" });
    expect(tables.user_service_deliverables[0].status).toBe("pending");
  });

  it("returns a ready row without asking the bucket again", async () => {
    seed("ready");

    const row = await confirmDeliverable(DELIVERABLE_ID);

    expect(row.status).toBe("ready");
    expect(headObjectSize).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("answers 404 for an unknown id", async () => {
    await expect(confirmDeliverable(DELIVERABLE_ID)).rejects.toMatchObject({ code: "deliverable_not_found", status: 404 });
  });
});
