import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/lib/db/queries";
import type { UserDocumentRow, UserServiceRow } from "@/lib/db/types";

/**
 * `confirmDocumentUpload` against a fake database that enforces the one rule
 * this module has to respect: `user_documents_live_slot_idx`
 * (0004_hardening.sql) allows a single `uploaded` or `approved` row per
 * order, document and applicant. The fake answers 23505 the way Postgres
 * does, so the test fails again if the drop ever moves back after the flip,
 * which is what made every replacement of a file waiting for review answer
 * 500 until 2026-09-22.
 *
 * `steps` records what happened in order: a row removed, an object removed
 * from the bucket, the row flipped. The order is the point: the row goes
 * first, and only while it is still `uploaded`, so a file the firm approves
 * in the meantime is refused rather than destroyed.
 */

type Row = Record<string, unknown>;

const { tables, steps, headObjectSize, deleteObject, getObjectBytes, notifyDocumentsReady, sendEmail } = vi.hoisted(
  () => ({
    tables: {} as Record<string, Row[]>,
    steps: [] as string[],
    headObjectSize: vi.fn(),
    deleteObject: vi.fn(),
    getObjectBytes: vi.fn(),
    notifyDocumentsReady: vi.fn(),
    sendEmail: vi.fn(),
  }),
);

vi.mock("@/lib/r2/client", () => ({ headObjectSize, deleteObject, getObjectBytes }));
// "Documents ready to review" is spied on here (its rule has tests of its
// own); the signed agreement email runs for real, down to the sender, which
// is where the attachment can be seen.
vi.mock("@/lib/orders/notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orders/notify")>()),
  notifyDocumentsReady,
}));
vi.mock("@/lib/email/send", () => ({ sendEmail }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("the admin client is not used here: the caller's database is passed on");
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => {
    throw new Error("headers() is not read here: the caller passes the origin");
  },
}));

import {
  APPROVED_LOCKED,
  DocumentError,
  REVIEW_LOCKED,
  SLOT_FILLED,
  confirmDocumentUpload,
  deleteOwnDocument,
} from "./confirm";

const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const DOC_ID = "66666666-6666-4666-8666-666666666666";
const LIVE = new Set(["uploaded", "approved"]);

/** The live slot index: at most one uploaded or approved row per slot. */
function violatesLiveSlot(rows: Row[]): boolean {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!LIVE.has(String(row.status))) continue;
    const slot = `${row.user_service_id}|${row.service_doc_id}|${row.applicant_index}`;
    if (seen.has(slot)) return true;
    seen.add(slot);
  }
  return false;
}

function fakeDb(): Db {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      let op: "select" | "delete" | "update" | "insert" = "select";
      let values: Row = {};
      const rows = () => (tables[table] ??= []);
      const matching = () => rows().filter((row) => filters.every(([column, value]) => row[column] === value));
      const run = () => {
        if (op === "insert") {
          const row: Row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...values };
          rows().push(row);
          return { data: [{ ...row }], error: null };
        }
        if (op === "delete") {
          const hit = matching();
          tables[table] = rows().filter((row) => !hit.includes(row));
          for (const row of hit) steps.push(`row ${row.id}`);
          return { data: hit.map((row) => ({ ...row })), error: null };
        }
        if (op === "update") {
          const hit = matching();
          const before = hit.map((row) => ({ ...row }));
          for (const row of hit) Object.assign(row, values);
          if (violatesLiveSlot(rows())) {
            hit.forEach((row, index) => Object.assign(row, before[index]));
            return {
              data: null,
              error: {
                code: "23505",
                message: 'duplicate key value violates unique constraint "user_documents_live_slot_idx"',
              },
            };
          }
          for (const row of hit) steps.push(`flip ${row.id} ${row.status}`);
          return { data: hit.map((row) => ({ ...row })), error: null };
        }
        return { data: matching().map((row) => ({ ...row })), error: null };
      };
      const query = {
        select() {
          return query;
        },
        update(next: Row) {
          op = "update";
          values = next;
          return query;
        },
        insert(next: Row) {
          op = "insert";
          values = next;
          return query;
        },
        delete() {
          op = "delete";
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        single() {
          const answer = run();
          return Promise.resolve({ data: answer.data?.[0] ?? null, error: answer.error });
        },
        maybeSingle() {
          const answer = run();
          return Promise.resolve({ data: answer.data?.[0] ?? null, error: answer.error });
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
  } as unknown as Db;
}

/**
 * The same fake, except that the flip finds the slot already live and
 * Postgres answers 23505, which is what two uploads confirmed at the same
 * moment produce. Only `update` is replaced; every read still comes from the
 * tables.
 */
function slotTakenDb(): Db {
  const conflict = {
    eq: () => conflict,
    select: () => conflict,
    single: async () => ({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "user_documents_live_slot_idx"',
      },
    }),
  };
  const base = fakeDb();
  return {
    from(table: string) {
      const query = base.from(table) as unknown as Record<string, unknown>;
      if (table !== "user_documents") return query;
      return { ...query, update: () => conflict };
    },
  } as unknown as Db;
}

const order: UserServiceRow = {
  id: ORDER_ID,
  user_id: "11111111-1111-4111-8111-111111111111",
  service_id: "44444444-4444-4444-8444-444444444444",
  submission_id: null,
  answers_snapshot: {},
  joint: false,
  applicants: 1,
  total_cents: 14900,
  currency: "eur",
  stage_key: "documents",
  stripe_checkout_session_id: "cs_test_1",
  stripe_payment_intent_id: "pi_test_1",
  paid_at: "2026-09-21T09:00:00.000Z",
  completed_at: null,
  report: null,
  created_at: "2026-09-21T08:55:00.000Z",
  updated_at: "2026-09-21T09:00:00.000Z",
};

function file(id: string, status: UserDocumentRow["status"], createdAt: string): UserDocumentRow {
  return {
    id,
    user_service_id: ORDER_ID,
    service_doc_id: DOC_ID,
    applicant_index: 0,
    storage_key: `orders/${ORDER_ID}/address/0/${id}.png`,
    file_name: "proof of address.png",
    mime_type: "image/png",
    size_bytes: 1_150_000,
    status,
    rejection_reason: null,
    uploaded_at: status === "pending" ? null : createdAt,
    reviewed_at: null,
    reviewed_by: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

const OLD = file("aaaa1111-1111-4111-8111-111111111111", "uploaded", "2026-09-21T10:00:00.000Z");
const NEW = file("bbbb2222-2222-4222-8222-222222222222", "pending", "2026-09-21T11:00:00.000Z");

function seed(rows: UserDocumentRow[]) {
  tables.user_documents = rows.map((row) => ({ ...row }) as Row);
}

function confirm(document: UserDocumentRow = NEW) {
  return confirmDocumentUpload({ db: fakeDb(), document, order, origin: null });
}

function stored(id: string): Row | undefined {
  return (tables.user_documents ?? []).find((row) => row.id === id);
}

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  steps.length = 0;
  headObjectSize.mockReset();
  headObjectSize.mockResolvedValue(NEW.size_bytes);
  deleteObject.mockReset();
  deleteObject.mockImplementation(async (key: string) => {
    steps.push(`object ${key}`);
  });
  notifyDocumentsReady.mockReset();
  notifyDocumentsReady.mockResolvedValue(undefined);
  getObjectBytes.mockReset();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "email_1" });
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logged.mockRestore();
  vi.unstubAllEnvs();
});

describe("confirmDocumentUpload", () => {
  it("finishes a first upload and tells the team", async () => {
    seed([NEW]);

    const confirmed = await confirm();

    expect(confirmed.status).toBe("uploaded");
    expect(confirmed.uploaded_at).not.toBeNull();
    expect(notifyDocumentsReady).toHaveBeenCalledTimes(1);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("replaces a file that is still waiting for review, dropping its row before the flip", async () => {
    seed([OLD, NEW]);

    const confirmed = await confirm();

    expect(confirmed.status).toBe("uploaded");
    expect(steps).toEqual([`row ${OLD.id}`, `object ${OLD.storage_key}`, `flip ${NEW.id} uploaded`]);
    expect(stored(OLD.id)).toBeUndefined();
    expect(stored(NEW.id)?.status).toBe("uploaded");
  });

  it("says nothing to the team when a file waiting for review is only swapped", async () => {
    seed([OLD, NEW]);

    await confirm();

    // The slot was filled before and it is filled now: the set never moved
    // from incomplete to complete, so the firm hears nothing.
    expect(notifyDocumentsReady).not.toHaveBeenCalled();
  });

  it("refuses when the firm approves the file being replaced a moment before the drop", async () => {
    // `status` reads `uploaded` once, for the sibling read, and `approved`
    // from then on: the review landed between the read and the delete.
    const approvedMeanwhile = { ...(file(OLD.id, "uploaded", OLD.created_at) as unknown as Row) };
    let reads = 0;
    Object.defineProperty(approvedMeanwhile, "status", {
      enumerable: true,
      get: () => (++reads === 1 ? "uploaded" : "approved"),
    });
    tables.user_documents = [approvedMeanwhile, { ...NEW } as Row];

    await expect(confirm()).rejects.toMatchObject({ name: "DocumentError", status: 409, message: APPROVED_LOCKED });
    expect(stored(OLD.id)).toBeDefined();
    expect(deleteObject).not.toHaveBeenCalled();
    expect(stored(NEW.id)?.status).toBe("pending");
    expect(notifyDocumentsReady).not.toHaveBeenCalled();
  });

  it("answers a refusal, not a failure, when another file reached the slot first", async () => {
    seed([NEW]);

    await expect(confirmDocumentUpload({ db: slotTakenDb(), document: NEW, order, origin: null })).rejects.toMatchObject(
      { name: "DocumentError", status: 409, message: SLOT_FILLED },
    );
    expect(notifyDocumentsReady).not.toHaveBeenCalled();
  });

  it("keeps a rejected file as the history of the review, and tells the team the set is complete again", async () => {
    const rejected = file("cccc3333-3333-4333-8333-333333333333", "rejected", "2026-09-21T09:30:00.000Z");
    seed([rejected, NEW]);

    await confirm();

    expect(stored(rejected.id)?.status).toBe("rejected");
    expect(deleteObject).not.toHaveBeenCalled();
    expect(notifyDocumentsReady).toHaveBeenCalledTimes(1);
  });

  it("refuses once the firm has approved a file for the slot, and writes nothing", async () => {
    const approved = file("dddd4444-4444-4444-8444-444444444444", "approved", "2026-09-21T10:30:00.000Z");
    seed([approved, NEW]);

    await expect(confirm()).rejects.toMatchObject({ name: "DocumentError", status: 409, message: APPROVED_LOCKED });
    expect(stored(approved.id)?.status).toBe("approved");
    expect(stored(NEW.id)?.status).toBe("pending");
    expect(deleteObject).not.toHaveBeenCalled();
    expect(notifyDocumentsReady).not.toHaveBeenCalled();
  });

  it("answers a row that is already uploaded without writing or sending", async () => {
    seed([OLD]);

    const confirmed = await confirm(OLD);

    expect(confirmed).toBe(OLD);
    expect(steps).toEqual([]);
    expect(notifyDocumentsReady).not.toHaveBeenCalled();
  });

  it("refuses a row that has already been reviewed", async () => {
    const rejected = file(NEW.id, "rejected", NEW.created_at);
    seed([rejected]);

    await expect(confirm(rejected)).rejects.toBeInstanceOf(DocumentError);
    expect(notifyDocumentsReady).not.toHaveBeenCalled();
  });

  it("keeps the replaced file when the bucket does not hold the new one", async () => {
    seed([OLD, NEW]);
    headObjectSize.mockResolvedValue(null);

    await expect(confirm()).rejects.toMatchObject({ status: 422 });
    expect(stored(OLD.id)?.status).toBe("uploaded");
    expect(stored(NEW.id)?.status).toBe("pending");
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("drops the row even when its object cannot be removed", async () => {
    seed([OLD, NEW]);
    deleteObject.mockRejectedValue(new Error("bucket unreachable"));

    const confirmed = await confirm();

    expect(confirmed.status).toBe("uploaded");
    expect(stored(OLD.id)).toBeUndefined();
    expect(logged).toHaveBeenCalled();
  });
});

/**
 * The signed service agreement (0013_signed_agreement_slot.sql): a slot whose
 * template is 'agreement'. A confirmed file in it goes to the team inbox once
 * per review round (src/lib/orders/signed-copy.ts), attached up to 8 MB under
 * the server's own name when the order was paid with real money and its
 * bytes are what its type says. The fake database carries the slot, the
 * service, the owner and the order's events; the sender is a spy, so the
 * attachment is visible. Most cases run on an order paid through live
 * Stripe; the test mode ones say so.
 */
describe("confirmDocumentUpload on the signed agreement slot", () => {
  const TEAM = "team@example.com";
  const LIMIT = 8 * 1024 * 1024;
  const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const ATTACHED_AS = `signed-agreement-${ORDER_ID}.pdf`;
  const SENT_NOTE = "Signed service agreement sent to the team inbox";

  /** An earlier send of this order's signed copy, as notifySignedAgreement records it. */
  function sentBefore(at: string): Row {
    return {
      id: crypto.randomUUID(),
      user_service_id: ORDER_ID,
      from_stage: "documents",
      to_stage: "documents",
      note: SENT_NOTE,
      actor_id: null,
      created_at: at,
    };
  }

  function sendEvents(): Row[] {
    return (tables.user_service_events ?? []).filter((row) => row.note === SENT_NOTE);
  }

  function signed(id: string, status: UserDocumentRow["status"], createdAt: string, sizeBytes = 1_150_000): UserDocumentRow {
    return {
      ...file(id, status, createdAt),
      storage_key: `orders/${ORDER_ID}/signed_agreement/0/${id}.pdf`,
      file_name: "signed agreement.pdf",
      mime_type: "application/pdf",
      size_bytes: sizeBytes,
    };
  }

  const SIGNED_OLD = signed("eeee5555-5555-4555-8555-555555555555", "uploaded", "2026-09-25T10:00:00.000Z");
  const SIGNED_NEW = signed("ffff6666-6666-4666-8666-666666666666", "pending", "2026-09-25T11:00:00.000Z");

  /** The order, paid through a live Checkout Session: its signed copy may be attached. */
  const LIVE_ORDER: UserServiceRow = { ...order, stripe_checkout_session_id: "cs_live_1" };

  function confirmSigned(document: UserDocumentRow, forOrder: UserServiceRow = LIVE_ORDER) {
    return confirmDocumentUpload({ db: fakeDb(), document, order: forOrder, origin: null });
  }

  function seedAgreement(rows: UserDocumentRow[], template: string | null = "agreement") {
    seed(rows);
    tables.service_docs = [
      {
        id: DOC_ID,
        service_id: order.service_id,
        key: "signed_agreement",
        label: "Signed service agreement",
        note: null,
        accepted_mime: ["application/pdf", "image/jpeg", "image/png"],
        max_bytes: 10_485_760,
        per_applicant: false,
        required: true,
        position: 4,
        template,
      },
    ];
    tables.services = [{ id: order.service_id, name: "NIF only", contract_template: "nif" }];
    tables.users = [{ id: order.user_id, email: "client@example.com" }];
  }

  /** The one email the spy received, as sendEmail took it. */
  function sentEmail() {
    expect(sendEmail).toHaveBeenCalledTimes(1);
    return sendEmail.mock.calls[0][0] as {
      to: string;
      subject: string;
      text: string;
      html: string;
      attachments?: { filename: string; content: Uint8Array }[];
    };
  }

  beforeEach(() => {
    vi.stubEnv("EMAIL_TEAM_INBOX", TEAM);
    getObjectBytes.mockResolvedValue(PDF_BYTES);
  });

  it("sends the team the signed copy, attached, with the facts and a link to the order", async () => {
    seedAgreement([SIGNED_NEW]);

    const confirmed = await confirmSigned(SIGNED_NEW);

    expect(confirmed.status).toBe("uploaded");
    expect(getObjectBytes).toHaveBeenCalledWith(SIGNED_NEW.storage_key);
    const email = sentEmail();
    expect(email.to).toBe(TEAM);
    expect(email.subject).toBe("Signed service agreement received: NIF only, client@example.com");
    // Attached under the server's name; the client's name is only a fact in the table.
    expect(email.attachments).toEqual([{ filename: ATTACHED_AS, content: PDF_BYTES }]);
    expect(email.text).toContain("The signed copy is attached to this email.");
    expect(email.text).toContain("Client: client@example.com");
    expect(email.text).toContain(`Order: ${ORDER_ID}`);
    expect(email.text).toContain("File: signed agreement.pdf");
    expect(email.text).toContain(`/admin/orders?order=${ORDER_ID}`);
    // A first upload into an empty set: the dossier rule runs as before.
    expect(notifyDocumentsReady).toHaveBeenCalledTimes(1);
    // The send is remembered on the order, on its stage, for the admin's history.
    expect(sendEvents()).toEqual([
      expect.objectContaining({ user_service_id: ORDER_ID, from_stage: "documents", to_stage: "documents", actor_id: null }),
    ]);
  });

  it("never attaches a file whose bytes are not what its type says, whatever the client called it", async () => {
    const disguised = { ...SIGNED_NEW, file_name: "agreement.pdf.html" };
    seedAgreement([disguised]);
    getObjectBytes.mockResolvedValue(new TextEncoder().encode("<html><script>alert(1)</script></html>"));

    const confirmed = await confirmSigned(disguised);

    expect(confirmed.status).toBe("uploaded");
    const email = sentEmail();
    expect(email.attachments).toBeUndefined();
    expect(email.text).toContain("The file could not be attached. Download it from the order.");
    expect(email.text).toContain("File: agreement.pdf.html");
    expect(logged).toHaveBeenCalled();
  });

  it("attaches a file of exactly 8 MB", async () => {
    // The row's size, which the bucket confirmed, is what decides. The bytes
    // handed back stay small so the spy does not hold 8 MB.
    const exact = signed(SIGNED_NEW.id, "pending", SIGNED_NEW.created_at, LIMIT);
    seedAgreement([exact]);
    headObjectSize.mockResolvedValue(LIMIT);

    await confirmSigned(exact);

    expect(getObjectBytes).toHaveBeenCalledWith(exact.storage_key);
    const [attachment] = sentEmail().attachments ?? [];
    expect(attachment?.content).toBe(PDF_BYTES);
  });

  it("sends it without the file, and says where to find it, when it is larger than 8 MB", async () => {
    const large = signed(SIGNED_NEW.id, "pending", SIGNED_NEW.created_at, LIMIT + 1);
    seedAgreement([large]);
    headObjectSize.mockResolvedValue(LIMIT + 1);

    const confirmed = await confirmSigned(large);

    expect(confirmed.status).toBe("uploaded");
    // Never downloaded just to be left out.
    expect(getObjectBytes).not.toHaveBeenCalled();
    const email = sentEmail();
    expect(email.attachments).toBeUndefined();
    expect(email.text).toContain("The file is larger than 8 MB, so it is not attached. Download it from the order.");
  });

  it.each([
    ["finds nothing", () => getObjectBytes.mockResolvedValue(null)],
    ["fails", () => getObjectBytes.mockRejectedValue(new Error("bucket unreachable"))],
  ])("sends it without the file when the bucket read %s", async (_case, arrange) => {
    seedAgreement([SIGNED_NEW]);
    arrange();

    const confirmed = await confirmSigned(SIGNED_NEW);

    expect(confirmed.status).toBe("uploaded");
    const email = sentEmail();
    expect(email.attachments).toBeUndefined();
    expect(email.text).toContain("The file could not be attached. Download it from the order.");
    expect(logged).toHaveBeenCalled();
  });

  it("sends again once the firm rejected the copy it had", async () => {
    const rejected = {
      ...signed("abab7777-7777-4777-8777-777777777777", "rejected", "2026-09-25T09:00:00.000Z"),
      reviewed_at: "2026-09-25T09:30:00.000Z",
    };
    seedAgreement([rejected, SIGNED_NEW]);
    tables.user_service_events = [sentBefore("2026-09-25T09:00:05.000Z")];

    await confirmSigned(SIGNED_NEW);

    expect(sentEmail().attachments).toHaveLength(1);
    expect(notifyDocumentsReady).toHaveBeenCalledTimes(1);
    expect(sendEvents()).toHaveLength(2);
  });

  it("sends nothing for a copy that replaces one still waiting for review, and the dossier email stays quiet", async () => {
    seedAgreement([SIGNED_OLD, SIGNED_NEW]);
    tables.user_service_events = [sentBefore("2026-09-25T10:00:05.000Z")];

    const confirmed = await confirmSigned(SIGNED_NEW);

    expect(confirmed.status).toBe("uploaded");
    expect(stored(SIGNED_OLD.id)).toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(getObjectBytes).not.toHaveBeenCalled();
    expect(notifyDocumentsReady).not.toHaveBeenCalled();
    expect(sendEvents()).toHaveLength(1);
  });

  it("sends the swapped copy when the first one never reached the inbox", async () => {
    // No send on record: the email of the copy it replaces did not go out.
    seedAgreement([SIGNED_OLD, SIGNED_NEW]);

    await confirmSigned(SIGNED_NEW);

    expect(sentEmail().attachments).toEqual([{ filename: ATTACHED_AS, content: PDF_BYTES }]);
  });

  it("sends one email over upload, remove, upload", async () => {
    seedAgreement([SIGNED_NEW]);
    await confirmSigned(SIGNED_NEW);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    // The client removes the copy (DELETE /api/documents/[id]) and sends another.
    tables.user_documents = [];
    const again = signed("cdcd8888-8888-4888-8888-888888888888", "pending", "2026-09-25T11:05:00.000Z");
    seed([again]);
    await confirmSigned(again);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEvents()).toHaveLength(1);
  });

  it("records nothing when the email did not go out, so the next copy is sent", async () => {
    seedAgreement([SIGNED_NEW]);
    sendEmail.mockResolvedValueOnce({ ok: false });

    await confirmSigned(SIGNED_NEW);

    expect(sendEvents()).toHaveLength(0);
  });

  it("sends nothing for a retried confirm of a copy already on record", async () => {
    seedAgreement([SIGNED_OLD]);

    await confirmSigned(SIGNED_OLD);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(getObjectBytes).not.toHaveBeenCalled();
  });

  it("sends a test mode order's notice without the file, and never reads it", async () => {
    seedAgreement([SIGNED_NEW]);

    // `order` was paid with a test card (cs_test_1), as anyone can on staging.
    const confirmed = await confirmSigned(SIGNED_NEW, order);

    expect(confirmed.status).toBe("uploaded");
    expect(getObjectBytes).not.toHaveBeenCalled();
    const email = sentEmail();
    expect(email.attachments).toBeUndefined();
    expect(email.text).toContain("This order was paid in test mode, so the file is not attached. Download it from the order.");
    expect(sendEvents()).toHaveLength(1);
  });

  it("treats a payment recorded outside the platform by what its record says", async () => {
    const outside: UserServiceRow = { ...order, stripe_checkout_session_id: null };

    seedAgreement([SIGNED_NEW]);
    tables.user_service_events = [
      { id: "e1", user_service_id: ORDER_ID, to_stage: "documents", note: "Paid outside the platform, recorded by the admin on the test site" },
    ];
    await confirmSigned(SIGNED_NEW, outside);
    expect(sentEmail().attachments).toBeUndefined();
    expect(getObjectBytes).not.toHaveBeenCalled();

    sendEmail.mockClear();
    seedAgreement([SIGNED_NEW]);
    tables.user_service_events = [
      { id: "e2", user_service_id: ORDER_ID, to_stage: "documents", note: "Paid outside the platform, recorded by the admin on the live site" },
    ];
    await confirmSigned(SIGNED_NEW, outside);
    expect(sentEmail().attachments).toEqual([{ filename: ATTACHED_AS, content: PDF_BYTES }]);
  });

  it("sends one email when a replacement is confirmed while the first copy's email is still on its way", async () => {
    seedAgreement([SIGNED_NEW]);
    let deliver: (bytes: Uint8Array) => void = () => {};
    getObjectBytes.mockImplementationOnce(
      () =>
        new Promise<Uint8Array>((resolve) => {
          deliver = resolve;
        }),
    );

    // The first copy's email waits on the bucket read.
    const first = confirmSigned(SIGNED_NEW);
    await vi.waitFor(() => expect(getObjectBytes).toHaveBeenCalledTimes(1));

    // Meanwhile the client replaces it, and the replacement is confirmed at once.
    const replacement = signed("abab9999-9999-4999-8999-999999999999", "pending", "2026-09-25T11:01:00.000Z");
    tables.user_documents.push({ ...replacement } as Row);
    await confirmSigned(replacement);

    deliver(PDF_BYTES);
    await first;

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEvents()).toHaveLength(1);
  });

  it("takes its claim back when it loses the round to a claim written a moment before", async () => {
    seedAgreement([SIGNED_NEW]);
    // Another confirm claimed the round between this call's check and its own row.
    const base = fakeDb();
    let inserted = false;
    const db = {
      from(table: string) {
        const query = base.from(table) as unknown as Record<string, (...args: unknown[]) => unknown>;
        if (table !== "user_service_events") return query;
        return {
          ...query,
          insert(values: Row) {
            if (!inserted) {
              inserted = true;
              (tables.user_service_events ??= []).push({
                ...values,
                id: "00000000-0000-4000-8000-000000000000",
                created_at: "2000-01-01T00:00:00.000Z",
              });
            }
            return query.insert(values);
          },
        };
      },
    } as unknown as Db;

    await confirmDocumentUpload({ db, document: SIGNED_NEW, order: LIVE_ORDER, origin: null });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(getObjectBytes).not.toHaveBeenCalled();
    expect(sendEvents().map((row) => row.id)).toEqual(["00000000-0000-4000-8000-000000000000"]);
  });

  it("sends nothing of the kind for an ordinary slot, or for a deed", async () => {
    for (const template of [null, "poa_nif"]) {
      seedAgreement([SIGNED_NEW], template);
      await confirmSigned(SIGNED_NEW);
    }

    expect(sendEmail).not.toHaveBeenCalled();
    expect(getObjectBytes).not.toHaveBeenCalled();
  });

  it("keeps the upload when the email does not go out", async () => {
    seedAgreement([SIGNED_NEW]);
    sendEmail.mockRejectedValue(new Error("Resend is down"));

    const confirmed = await confirmSigned(SIGNED_NEW);

    expect(confirmed.status).toBe("uploaded");
    expect(stored(SIGNED_NEW.id)?.status).toBe("uploaded");
    expect(logged).toHaveBeenCalled();
  });

  it("keeps the upload, and sends nothing, when no team inbox is set", async () => {
    seedAgreement([SIGNED_NEW]);
    vi.stubEnv("EMAIL_TEAM_INBOX", "");
    const warned = vi.spyOn(console, "warn").mockImplementation(() => {});

    const confirmed = await confirmSigned(SIGNED_NEW);

    expect(confirmed.status).toBe("uploaded");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(warned).toHaveBeenCalled();
    warned.mockRestore();
  });

  it("keeps the upload when the slot cannot be read, and sends nothing", async () => {
    seedAgreement([SIGNED_NEW]);
    const base = fakeDb();
    const db = {
      from(table: string) {
        const query = base.from(table) as unknown as Record<string, unknown>;
        if (table !== "service_docs") return query;
        const broken = {
          select: () => broken,
          eq: () => broken,
          maybeSingle: async () => ({ data: null, error: { message: "service_docs is down" } }),
        };
        return broken;
      },
    } as unknown as Db;

    const confirmed = await confirmDocumentUpload({ db, document: SIGNED_NEW, order: LIVE_ORDER, origin: null });

    expect(confirmed.status).toBe("uploaded");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
  });
});

describe("deleteOwnDocument", () => {
  it("removes the row first and the object only once a row has gone", async () => {
    seed([OLD]);

    await deleteOwnDocument(fakeDb(), OLD);

    expect(steps).toEqual([`row ${OLD.id}`, `object ${OLD.storage_key}`]);
    expect(stored(OLD.id)).toBeUndefined();
  });

  it("refuses, and keeps the file, when the firm reviewed it a moment ago", async () => {
    // The row the route read as `uploaded` is `approved` by the time the
    // delete runs, so the conditional delete matches nothing.
    seed([{ ...OLD, status: "approved" }]);

    await expect(deleteOwnDocument(fakeDb(), OLD)).rejects.toMatchObject({
      name: "DocumentError",
      status: 409,
      message: APPROVED_LOCKED,
    });
    expect(stored(OLD.id)?.status).toBe("approved");
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("refuses with the plain line when the row went altogether", async () => {
    seed([]);

    await expect(deleteOwnDocument(fakeDb(), OLD)).rejects.toMatchObject({ status: 409, message: REVIEW_LOCKED });
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("refuses a key outside the order's folder before the bucket is touched", async () => {
    const stray = { ...OLD, storage_key: `deliverables/${ORDER_ID}/file.png` };
    seed([stray]);

    await expect(deleteOwnDocument(fakeDb(), stray)).rejects.toThrow(/outside its order/);
    expect(deleteObject).not.toHaveBeenCalled();
    expect(stored(OLD.id)).toBeDefined();
  });
});
