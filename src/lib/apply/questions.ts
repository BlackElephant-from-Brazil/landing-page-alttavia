import { applyCopy } from "@/content/apply";
import type {
  Condition,
  HouseholdOptions,
  QuestionExtras,
  QuestionOption,
  QuestionRow,
  Rule,
} from "@/lib/db/types";
import { isCountryCode, isEea } from "./countries";
import type { Answers } from "./types";

/**
 * The six questions of the initial form as rows of `public.questions`, and
 * the two functions that turn any set of rows into wizard steps.
 *
 * `SEED_QUESTIONS` is what `scripts/generate-questions-seed.mjs` writes into
 * `supabase/migrations/0003_seed_questions.sql`, and what the wizard falls
 * back to when the database cannot be read. Its copy is imported from
 * `src/content/apply.ts` rather than retyped, so the seed and the fallback
 * cannot drift from each other.
 *
 * Honest limit: a question added in the database is asked by the wizard, but
 * `recommend()` only reads the six answer keys in `Answers`, and
 * `sanitizeAnswers()` (which runs on every refresh and on submit) keeps only
 * those keys. So a new question changes nothing about what is sold, and its
 * answer is not stored, until the code learns its key.
 */

/**
 * Copy the wizard needs beyond the columns the contract names. Stored in the
 * `extras` jsonb column next to `childrenCheckbox` and `personLabels`, all
 * optional, all read with `extrasOf()` so a row from an older seed still
 * renders.
 *
 *   label, placeholder   select controls (country, per-person-country, and a
 *                        choice rendered as a select)
 *   control              "select" renders a `choice` as a dropdown instead of
 *                        radio cards (the visa list is eleven entries long)
 *   coupleTitle          the title when two people are applying
 *   coupleOptions        `per-person-yes-no` labels when two people are
 *                        applying ("Yes" under each name instead of "Yes, I
 *                        have one")
 */
export type WizardExtras = QuestionExtras & {
  label?: string;
  placeholder?: string;
  control?: "select";
  coupleTitle?: string;
  coupleOptions?: QuestionOption[];
};

const NOW = "2026-09-11T00:00:00.000Z";

function row(
  fields: Pick<QuestionRow, "id" | "key" | "answer_key" | "position" | "kind" | "title"> & {
    help?: string;
    options?: QuestionOption[] | HouseholdOptions;
    extras?: WizardExtras;
    visible_when?: Rule;
  },
): QuestionRow {
  return {
    id: fields.id,
    key: fields.key,
    answer_key: fields.answer_key,
    position: fields.position,
    kind: fields.kind,
    title: fields.title,
    help: fields.help ?? null,
    options: fields.options ?? [],
    extras: fields.extras ?? {},
    visible_when: fields.visible_when ?? null,
    active: true,
    created_at: NOW,
    updated_at: NOW,
  };
}

const steps = applyCopy.steps;

const NOT_MORE: Condition = { field: "applicants", op: "neq", value: "more" };

function choiceOptions<K extends string>(
  values: readonly K[],
  labels: Record<K, { label: string; hint: string }>,
): QuestionOption[] {
  return values.map((value) => ({ value, label: labels[value].label, description: labels[value].hint }));
}

/** The six questions, in the order they are asked. Ids are fixed so reruns of the seed update in place. */
export const SEED_QUESTIONS: readonly QuestionRow[] = [
  row({
    id: "5b1f0c1e-0001-4a6e-9d3b-0c1a2b3c4d01",
    key: "residence",
    answer_key: "residence",
    position: 1,
    kind: "country",
    title: steps.residence.heading,
    help: steps.residence.help,
    extras: { label: steps.residence.label, placeholder: steps.residence.placeholder },
  }),
  row({
    id: "5b1f0c1e-0002-4a6e-9d3b-0c1a2b3c4d02",
    key: "who",
    answer_key: "applicants",
    position: 2,
    kind: "choice",
    title: steps.who.heading,
    options: choiceOptions(["one", "two", "more"] as const, steps.who.options),
    extras: {
      childrenCheckbox: { key: "childrenNifs", label: steps.who.children, help: steps.who.childrenHint },
    },
  }),
  row({
    id: "5b1f0c1e-0003-4a6e-9d3b-0c1a2b3c4d03",
    key: "has-nif",
    answer_key: "hasNif",
    position: 3,
    kind: "per-person-yes-no",
    title: steps.hasNif.heading,
    help: steps.hasNif.help,
    options: [
      { value: "yes", label: steps.hasNif.yes },
      { value: "no", label: steps.hasNif.no },
    ],
    extras: {
      personLabels: [...steps.hasNif.person],
      coupleTitle: steps.hasNif.headingCouple,
      coupleOptions: [
        { value: "yes", label: steps.hasNif.yesPartner },
        { value: "no", label: steps.hasNif.noPartner },
      ],
    },
    visible_when: { all: [NOT_MORE] },
  }),
  row({
    id: "5b1f0c1e-0004-4a6e-9d3b-0c1a2b3c4d04",
    key: "bank",
    answer_key: "bank",
    position: 4,
    kind: "choice-by-household",
    title: steps.bank.heading,
    help: steps.bank.help,
    options: {
      one: choiceOptions(["yes", "none"] as const, steps.bank.options),
      two: choiceOptions(["joint", "separate", "none"] as const, steps.bank.options),
    },
    visible_when: { all: [NOT_MORE] },
  }),
  row({
    id: "5b1f0c1e-0005-4a6e-9d3b-0c1a2b3c4d05",
    key: "passport",
    answer_key: "passport",
    position: 5,
    kind: "per-person-country",
    title: steps.passport.heading,
    help: steps.passport.help,
    extras: {
      personLabels: [...steps.passport.person],
      coupleTitle: steps.passport.headingCouple,
      placeholder: steps.passport.placeholder,
    },
    visible_when: { all: [NOT_MORE, { field: "bank", op: "neq", value: "separate" }] },
  }),
  row({
    id: "5b1f0c1e-0006-4a6e-9d3b-0c1a2b3c4d06",
    key: "visa",
    answer_key: "visa",
    position: 6,
    kind: "choice",
    title: steps.visa.heading,
    help: steps.visa.help,
    options: (
      ["d7", "d8", "d2", "d9", "d1", "d3", "d4", "d5", "d6", "eu-family", "none"] as const
    ).map((value) => ({ value, label: steps.visa.options[value] })),
    extras: { control: "select", label: steps.visa.label, placeholder: steps.visa.placeholder },
    // Only the bank cares about the visa, and only for non EEA passports.
    visible_when: {
      all: [NOT_MORE, { field: "bank", op: "in", value: ["yes", "joint"] }, { pred: "anyNonEeaPassport" }],
    },
  }),
];

/* -------------------------------------------------------------------------- */
/* Rules                                                                       */
/* -------------------------------------------------------------------------- */

export function peopleCount(a: Answers): 1 | 2 {
  return a.applicants === "two" ? 2 : 1;
}

function fieldValue(a: Answers, field: string): unknown {
  return (a as Record<string, unknown>)[field];
}

function sameValue(x: unknown, y: unknown): boolean {
  return x === y;
}

function evaluateCondition(c: Condition, a: Answers): boolean {
  if ("pred" in c) {
    switch (c.pred) {
      case "anyNonEeaPassport":
        // An unanswered passport counts as non EEA, the way the hardcoded
        // steps did: the screen is "visible" but never reachable until the
        // passports are in, so nothing changes for the visitor.
        return Array.from({ length: peopleCount(a) }, (_, i) => a.passport?.[i]).some((p) => !isEea(p));
      default:
        return false;
    }
  }
  const value = fieldValue(a, c.field);
  switch (c.op) {
    case "eq":
      return sameValue(value, c.value);
    case "neq":
      return !sameValue(value, c.value);
    case "in":
      return Array.isArray(c.value) && c.value.some((v) => sameValue(v, value));
    case "notIn":
      return !Array.isArray(c.value) || !c.value.some((v) => sameValue(v, value));
    default:
      return false;
  }
}

/** True when the rule lets a question show for these answers. `null` always does. */
export function evaluateRule(rule: Rule | undefined, a: Answers): boolean {
  if (!rule) return true;
  if ("all" in rule && Array.isArray(rule.all)) return rule.all.every((c) => evaluateCondition(c, a));
  if ("any" in rule && Array.isArray(rule.any)) return rule.any.some((c) => evaluateCondition(c, a));
  return true;
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */

export type QuestionStep = {
  /** The row's `key`: "residence", "who", "has-nif", "bank", "passport", "visa". */
  id: string;
  row: QuestionRow;
  visibleWhen: (a: Answers) => boolean;
  isValid: (a: Answers) => boolean;
};

export function isHouseholdOptions(options: QuestionRow["options"]): options is HouseholdOptions {
  return !Array.isArray(options) && typeof options === "object" && options !== null && "one" in options;
}

/** The option list a row shows to this household. Always an array. */
export function optionsFor(row: QuestionRow, a: Answers): QuestionOption[] {
  const options = row.options;
  if (isHouseholdOptions(options)) {
    const list = peopleCount(a) === 2 ? options.two : options.one;
    return Array.isArray(list) ? list : [];
  }
  return Array.isArray(options) ? (options as QuestionOption[]) : [];
}

/** The row's extras, typed for the wizard, with the jsonb treated as data. */
export function extrasOf(row: QuestionRow): WizardExtras {
  const extras = row.extras;
  return extras && typeof extras === "object" ? (extras as WizardExtras) : {};
}

function everyPerson(a: Answers, check: (i: number) => boolean): boolean {
  return Array.from({ length: peopleCount(a) }, (_, i) => i).every(check);
}

function validatorFor(row: QuestionRow): (a: Answers) => boolean {
  const key = row.answer_key;
  switch (row.kind) {
    case "country":
      return (a) => isCountryCode(fieldValue(a, key));
    case "choice":
      return (a) => {
        const value = fieldValue(a, key);
        return value !== undefined && optionsFor(row, a).some((o) => o.value === value);
      };
    case "choice-by-household":
      return (a) => {
        const value = fieldValue(a, key);
        return value !== undefined && optionsFor(row, a).some((o) => o.value === value);
      };
    case "per-person-yes-no":
      return (a) => {
        const list = fieldValue(a, key);
        return everyPerson(a, (i) => Array.isArray(list) && typeof list[i] === "boolean");
      };
    case "per-person-country":
      return (a) => {
        const list = fieldValue(a, key);
        return everyPerson(a, (i) => Array.isArray(list) && isCountryCode(list[i]));
      };
    default:
      // A kind this build does not know cannot be answered, so it never
      // blocks: the screen is skipped rather than trapping the visitor.
      return () => true;
  }
}

/**
 * Turns question rows into wizard steps: active rows in `position` order,
 * `visibleWhen` from `visible_when`, `isValid` from `kind`. For
 * `SEED_QUESTIONS` this reproduces the hardcoded steps the wizard shipped
 * with, which `questions.test.ts` checks against a frozen copy of them.
 */
export function buildSteps(rows: readonly QuestionRow[]): QuestionStep[] {
  return [...rows]
    .filter((r) => r.active !== false)
    .sort((x, y) => x.position - y.position)
    .map((r) => ({
      id: r.key,
      row: r,
      visibleWhen: (a) => evaluateRule(r.visible_when, a),
      isValid: validatorFor(r),
    }));
}
