import type { Answers } from "@/lib/apply/types";
import type { QuestionRow } from "@/lib/db/types";

export type StepProps = {
  /** The question row this screen renders: title, help, options, extras. */
  question: QuestionRow;
  answers: Answers;
  /** Merges a partial update into the answers. */
  onChange: (patch: Partial<Answers>) => void;
};

/** The current value of the row's answer field. The row decides the key, so the read is untyped. */
export function answerOf(answers: Answers, question: QuestionRow): unknown {
  return (answers as Record<string, unknown>)[question.answer_key];
}

/** A patch that writes `value` into the row's answer field. */
export function patchFor(question: QuestionRow, value: unknown): Partial<Answers> {
  return { [question.answer_key]: value } as Partial<Answers>;
}
