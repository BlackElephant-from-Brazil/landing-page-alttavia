import { buildSteps, peopleCount, SEED_QUESTIONS, type QuestionStep } from "./questions";
import type { Answers, Applicants, BankChoice, Visa } from "./types";

/**
 * The wizard's screens, in order. Pure data so the wizard, the progress bar
 * and the deep link clamp all agree on what "step 3" means.
 *
 * Since the questions moved to the database, the steps are built from
 * question rows by `buildSteps()` in ./questions.ts. `STEPS` is the build of
 * the seed rows, which is what the wizard used to hardcode and what it falls
 * back to when the database cannot be read. Every helper below takes an
 * optional step list so the wizard can pass the one built from live rows;
 * without it they work on `STEPS` exactly as before.
 *
 * `visibleWhen` hides screens that do not apply (partner rows, the visa screen
 * for all EEA passports). `isValid` gates the Continue button and is also how
 * a `?step=` deep link is clamped: a visitor can never land on a screen whose
 * predecessors are unanswered.
 *
 * Exit screens (living in Portugal, more than two adults, separate accounts)
 * are not steps. The engine raises them, and the wizard renders them in place
 * of the next screen.
 */

/** The keys of the six seeded questions. Rows added later carry other keys. */
export type StepId = "residence" | "who" | "has-nif" | "bank" | "passport" | "visa";

export type Step = QuestionStep;

export { peopleCount };

export const APPLICANT_OPTIONS: readonly Applicants[] = ["one", "two", "more"];
export const BANK_OPTIONS_SINGLE: readonly BankChoice[] = ["yes", "none"];
export const BANK_OPTIONS_COUPLE: readonly BankChoice[] = ["joint", "separate", "none"];
export const VISA_OPTIONS: readonly Visa[] = [
  "d7",
  "d8",
  "d2",
  "d9",
  "d1",
  "d3",
  "d4",
  "d5",
  "d6",
  "eu-family",
  "none",
];

export const STEPS: readonly Step[] = buildSteps(SEED_QUESTIONS);

/** Steps that apply to these answers, in order. */
export function visibleSteps(a: Answers, steps: readonly Step[] = STEPS): Step[] {
  return steps.filter((s) => s.visibleWhen(a));
}

/**
 * The furthest screen this visitor may be on: the first visible step whose
 * answer is missing, or one past the last step (the result) when all are in.
 */
export function maxReachable(a: Answers, steps: readonly Step[] = STEPS): number {
  const visible = visibleSteps(a, steps);
  const firstInvalid = visible.findIndex((s) => !s.isValid(a));
  return firstInvalid === -1 ? visible.length : firstInvalid;
}

/** True when every visible step is answered, so the result can be shown. */
export function isComplete(a: Answers, steps: readonly Step[] = STEPS): boolean {
  return maxReachable(a, steps) === visibleSteps(a, steps).length;
}

/**
 * Trims answers that belong to screens no longer visible, so a visitor who
 * goes back and switches from "me and my partner" to "just me" does not carry
 * a partner's passport into the engine.
 *
 * Knows the six seeded fields by name. A question added in the database is
 * not pruned here; see the note at the top of ./questions.ts.
 */
export function pruneAnswers(a: Answers, steps: readonly Step[] = STEPS): Answers {
  const people = peopleCount(a);
  const next: Answers = { ...a };
  if (a.applicants === "more") {
    delete next.hasNif;
    delete next.bank;
    delete next.passport;
    delete next.visa;
    return next;
  }
  if (next.hasNif) next.hasNif = next.hasNif.slice(0, people);
  if (next.passport) next.passport = next.passport.slice(0, people);
  if (next.bank !== undefined) {
    const options = people === 2 ? BANK_OPTIONS_COUPLE : BANK_OPTIONS_SINGLE;
    if (!options.includes(next.bank)) delete next.bank;
  }
  const visa = steps.find((s) => s.id === "visa") ?? STEPS.find((s) => s.id === "visa");
  if (visa && !visa.visibleWhen(next)) delete next.visa;
  return next;
}
