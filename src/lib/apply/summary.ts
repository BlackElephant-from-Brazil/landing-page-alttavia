import { applyCopy } from "@/content/apply";
import { countryByCode } from "@/lib/apply/countries";
import type { QuestionRow } from "@/lib/db/types";
import type { Answers, Applicants, BankChoice, Visa } from "./types";

/**
 * Turns the wizard's answers into label and value pairs for the dashboard's
 * "what you told us" block.
 *
 * Labels come from the question rows when they are passed (their `title`),
 * otherwise from the step copy in src/content/apply.ts, so the dashboard
 * reads the same question the visitor answered. Values are short English:
 * country names, the option labels the wizard showed, yes or not yet.
 *
 * Only answered questions appear, in question order. Per person answers are
 * written as "You: … · Your partner: …" for two applicants, and as the bare
 * value for one. `preselected` is the landing's click, not an answer, and is
 * left out.
 */

export type SummaryItem = {
  label: string;
  value: string;
};

const steps = applyCopy.steps;

/** The answer fields a question row can fill, in the order they are asked. */
const ANSWER_KEYS = ["residence", "applicants", "hasNif", "bank", "passport", "visa"] as const;
type AnswerKey = (typeof ANSWER_KEYS)[number];

function peopleCount(a: Answers): 1 | 2 {
  return a.applicants === "two" ? 2 : 1;
}

function countryName(code: string | undefined): string | undefined {
  return countryByCode(code)?.name;
}

/** "You: A · Your partner: B" for two people, "A" for one. */
function perPerson(a: Answers, render: (i: number) => string | undefined): string | undefined {
  const people = peopleCount(a);
  const values = Array.from({ length: people }, (_, i) => render(i));
  if (values.some((v) => v === undefined)) return undefined;
  if (people === 1) return values[0];
  return values.map((v, i) => `${steps.hasNif.person[i]}: ${v}`).join(" · ");
}

function applicantsLabel(value: Applicants | undefined): string | undefined {
  return value ? steps.who.options[value]?.label : undefined;
}

function bankLabel(value: BankChoice | undefined): string | undefined {
  return value ? steps.bank.options[value]?.label : undefined;
}

function visaLabel(value: Visa | undefined): string | undefined {
  return value ? steps.visa.options[value] : undefined;
}

/** The value shown for one answer field, or undefined when unanswered. */
function valueFor(key: AnswerKey, a: Answers): string | undefined {
  switch (key) {
    case "residence":
      return countryName(a.residence);
    case "applicants":
      return applicantsLabel(a.applicants);
    case "hasNif":
      return perPerson(a, (i) => {
        const has = a.hasNif?.[i];
        if (typeof has !== "boolean") return undefined;
        if (peopleCount(a) === 1) return has ? steps.hasNif.yes : steps.hasNif.no;
        return has ? steps.hasNif.yesPartner : steps.hasNif.noPartner;
      });
    case "bank":
      return bankLabel(a.bank);
    case "passport":
      return perPerson(a, (i) => countryName(a.passport?.[i]));
    case "visa":
      return visaLabel(a.visa);
  }
}

/** The fallback label from the step copy, when no question row is passed. */
function copyLabel(key: AnswerKey, a: Answers): string {
  const couple = peopleCount(a) === 2;
  switch (key) {
    case "residence":
      return steps.residence.heading;
    case "applicants":
      return steps.who.heading;
    case "hasNif":
      return couple ? steps.hasNif.headingCouple : steps.hasNif.heading;
    case "bank":
      return steps.bank.heading;
    case "passport":
      return couple ? steps.passport.headingCouple : steps.passport.heading;
    case "visa":
      return steps.visa.heading;
  }
}

function isAnswerKey(value: string): value is AnswerKey {
  return (ANSWER_KEYS as readonly string[]).includes(value);
}

/**
 * Label and value pairs for the answers, in question order.
 *
 * With question rows, the order and the labels are theirs and a row whose
 * `answer_key` the code does not know is skipped (its value cannot be
 * rendered). Without rows, the six known questions are used with the step
 * copy as labels.
 */
export function summarizeAnswers(answers: Answers, questions?: readonly QuestionRow[]): SummaryItem[] {
  const items: SummaryItem[] = [];

  const ordered: { key: AnswerKey; label: string }[] = questions?.length
    ? [...questions]
        .sort((x, y) => x.position - y.position)
        .flatMap((q) => (isAnswerKey(q.answer_key) ? [{ key: q.answer_key, label: q.title }] : []))
    : ANSWER_KEYS.map((key) => ({ key, label: copyLabel(key, answers) }));

  for (const { key, label } of ordered) {
    const value = valueFor(key, answers);
    if (value === undefined) continue;
    items.push({ label, value });

    // The children checkbox rides on the "who" question and is only shown
    // when ticked, the way the wizard shows it.
    if (key === "applicants" && answers.childrenNifs) {
      const row = questions?.find((q) => q.answer_key === "applicants");
      const label = row?.extras?.childrenCheckbox?.label ?? steps.who.children;
      items.push({ label, value: steps.hasNif.yesPartner });
    }
  }

  return items;
}
