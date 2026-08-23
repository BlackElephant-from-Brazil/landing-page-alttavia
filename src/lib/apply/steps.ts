import { isCountryCode, isEea } from "./countries";
import type { Answers, Applicants, BankChoice, Visa } from "./types";

/**
 * The wizard's screens, in order. Pure data so the wizard, the progress bar
 * and the deep link clamp all agree on what "step 3" means.
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

export type StepId = "residence" | "who" | "has-nif" | "bank" | "passport" | "visa";

export type Step = {
  id: StepId;
  visibleWhen: (a: Answers) => boolean;
  isValid: (a: Answers) => boolean;
};

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

export function peopleCount(a: Answers): 1 | 2 {
  return a.applicants === "two" ? 2 : 1;
}

function everyPerson(a: Answers, check: (i: number) => boolean): boolean {
  return Array.from({ length: peopleCount(a) }, (_, i) => i).every(check);
}

export const STEPS: readonly Step[] = [
  {
    id: "residence",
    visibleWhen: () => true,
    isValid: (a) => isCountryCode(a.residence),
  },
  {
    id: "who",
    visibleWhen: () => true,
    isValid: (a) => a.applicants !== undefined && APPLICANT_OPTIONS.includes(a.applicants),
  },
  {
    id: "has-nif",
    visibleWhen: (a) => a.applicants !== "more",
    isValid: (a) => everyPerson(a, (i) => typeof a.hasNif?.[i] === "boolean"),
  },
  {
    id: "bank",
    visibleWhen: (a) => a.applicants !== "more",
    isValid: (a) => {
      const options = a.applicants === "two" ? BANK_OPTIONS_COUPLE : BANK_OPTIONS_SINGLE;
      return a.bank !== undefined && options.includes(a.bank);
    },
  },
  {
    id: "passport",
    visibleWhen: (a) => a.applicants !== "more" && a.bank !== "separate",
    isValid: (a) => everyPerson(a, (i) => isCountryCode(a.passport?.[i])),
  },
  {
    id: "visa",
    // Only the bank cares about the visa, and only for non EEA passports.
    visibleWhen: (a) =>
      a.applicants !== "more" &&
      (a.bank === "yes" || a.bank === "joint") &&
      Array.from({ length: peopleCount(a) }, (_, i) => a.passport?.[i]).some((p) => !isEea(p)),
    isValid: (a) => a.visa !== undefined && VISA_OPTIONS.includes(a.visa),
  },
];

/** Steps that apply to these answers, in order. */
export function visibleSteps(a: Answers): Step[] {
  return STEPS.filter((s) => s.visibleWhen(a));
}

/**
 * The furthest screen this visitor may be on: the first visible step whose
 * answer is missing, or one past the last step (the result) when all are in.
 */
export function maxReachable(a: Answers): number {
  const steps = visibleSteps(a);
  const firstInvalid = steps.findIndex((s) => !s.isValid(a));
  return firstInvalid === -1 ? steps.length : firstInvalid;
}

/** True when every visible step is answered, so the result can be shown. */
export function isComplete(a: Answers): boolean {
  return maxReachable(a) === visibleSteps(a).length;
}

/**
 * Trims answers that belong to screens no longer visible, so a visitor who
 * goes back and switches from "me and my partner" to "just me" does not carry
 * a partner's passport into the engine.
 */
export function pruneAnswers(a: Answers): Answers {
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
  if (!STEPS.find((s) => s.id === "visa")!.visibleWhen(next)) delete next.visa;
  return next;
}
