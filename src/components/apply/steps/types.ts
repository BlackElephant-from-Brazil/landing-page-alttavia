import type { Answers } from "@/lib/apply/types";

export type StepProps = {
  answers: Answers;
  /** Merges a partial update into the answers. */
  onChange: (patch: Partial<Answers>) => void;
};
