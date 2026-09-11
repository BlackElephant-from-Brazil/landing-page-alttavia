import { alternativeFor } from "@/content/apply";
import { SEED_QUESTIONS } from "@/lib/apply/questions";
import { recommend } from "@/lib/apply/recommend";
import { sanitizeAnswers } from "@/lib/apply/storage";
import { isComplete, peopleCount, pruneAnswers } from "@/lib/apply/steps";
import { isProductId, type ProductId } from "@/lib/apply/types";
import { getActiveQuestions, getServiceBySlug } from "@/lib/db/queries";
import type { QuestionRow } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/user";

/**
 * POST /api/apply/submit, body `{ answers, product? }`. Contract section 8.
 *
 * Turns the wizard's answers into an order for the signed in user. The
 * browser sends answers and, at most, which of the engine's valid products
 * it chose; everything with money on it (product, quantity, joint, total) is
 * computed here from the answers, by the same engine and the same quantity
 * rule the result screen used, so an alternative button can never charge one
 * NIF for two adults.
 *
 * Writes, with the admin client, in this order: user_answers (one row per
 * answered seeded question, one submission_id), the user_services row at
 * awaiting_payment, and its first user_service_events row. There is no
 * transaction across the three; a failure after the first leaves answers
 * without an order, which the log names and nothing reads.
 *
 * Answers `{ userServiceId }`; the client then navigates to /en/dashboard.
 */

const SAVE_ERROR = "Could not save your application";

function fail(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/** Question rows to record answers against: the database's, or the seed when it cannot be read. */
async function questionRows(admin: ReturnType<typeof createAdminClient>): Promise<readonly QuestionRow[]> {
  try {
    const rows = await getActiveQuestions(admin);
    return rows.length > 0 ? rows : SEED_QUESTIONS;
  } catch (err) {
    console.error("POST /api/apply/submit: could not read questions, using the seed:", err);
    return SEED_QUESTIONS;
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return fail(401, "Sign in to continue.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Invalid request.");
  }
  const input = body && typeof body === "object" ? (body as { answers?: unknown; product?: unknown }) : {};

  const answers = pruneAnswers(sanitizeAnswers(input.answers));
  // The engine tolerates gaps (an empty object prices as one NIF), so the
  // wizard's own completeness check gates the order: every visible question
  // answered, the way the result screen requires before it renders.
  if (!isComplete(answers)) return fail(422, "Answer every question before continuing.");
  const rec = recommend(answers);
  if (rec.kind === "exit") return fail(422, "These answers do not lead to an order.");

  let product: ProductId = rec.product;
  if (input.product !== undefined) {
    if (!isProductId(input.product) || !rec.valid.includes(input.product)) {
      return fail(422, "That package does not fit these answers.");
    }
    product = input.product;
  }
  const order = alternativeFor(rec, product, answers);

  try {
    const admin = createAdminClient();

    const service = await getServiceBySlug(admin, product);
    if (!service) {
      console.error(`POST /api/apply/submit: service ${product} is missing from public.services`);
      return fail(500, SAVE_ERROR);
    }

    const submissionId = crypto.randomUUID();
    const rows = await questionRows(admin);
    // The seeded keys are the ones the FK on user_answers.question_key can
    // satisfy; a row read from the database always exists there too.
    const answerRows = rows
      .filter((q) => q.active !== false)
      .flatMap((q) => {
        const value = (answers as Record<string, unknown>)[q.answer_key];
        if (value === undefined) return [];
        // The children checkbox rides on the "who" question; it is stored with it.
        const extra =
          q.extras?.childrenCheckbox && answers.childrenNifs !== undefined
            ? { [q.extras.childrenCheckbox.key]: answers.childrenNifs }
            : {};
        const answer = Object.keys(extra).length > 0 ? { value, ...extra } : value;
        return [{ user_id: user.id, submission_id: submissionId, question_key: q.key, answer }];
      });

    if (answerRows.length > 0) {
      const { error } = await admin.from("user_answers").insert(answerRows);
      if (error) throw new Error(`user_answers: ${error.message}`);
    }

    const { data: created, error: orderError } = await admin
      .from("user_services")
      .insert({
        user_id: user.id,
        service_id: service.id,
        submission_id: submissionId,
        answers_snapshot: answers,
        quantity: order.quantity,
        joint: order.joint,
        applicants: peopleCount(answers),
        total_cents: order.totalCents,
        currency: service.currency || "eur",
        stage_key: "awaiting_payment",
      })
      .select("id")
      .single();
    if (orderError || !created) {
      throw new Error(`user_services: ${orderError?.message ?? "no row returned"} (submission ${submissionId})`);
    }
    const userServiceId = (created as { id: string }).id;

    const { error: eventError } = await admin.from("user_service_events").insert({
      user_service_id: userServiceId,
      from_stage: null,
      to_stage: "awaiting_payment",
      note: "Application submitted",
      actor_id: user.id,
    });
    if (eventError) throw new Error(`user_service_events: ${eventError.message} (order ${userServiceId})`);

    return Response.json({ userServiceId });
  } catch (err) {
    console.error(`POST /api/apply/submit failed for user ${user.id}:`, err);
    return fail(500, SAVE_ERROR);
  }
}
