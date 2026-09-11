import { OptionCard } from "@/components/apply/ui/option-card";
import { StepFrame } from "@/components/apply/ui/step-frame";
import { extrasOf, optionsFor, peopleCount } from "@/lib/apply/questions";
import { answerOf, patchFor, type StepProps } from "./types";

/**
 * Kind `per-person-yes-no`: one yes/no pair per applicant, stored as
 * `boolean[]` (0 = you, 1 = your partner). `options` holds the two labels for
 * a single applicant; `extras.coupleOptions` and `extras.coupleTitle` replace
 * them when two people apply, and `extras.personLabels` names the rows.
 */
export function PerPersonYesNoStep({ question, answers, onChange }: StepProps) {
  const extras = extrasOf(question);
  const people = peopleCount(answers);
  const couple = people === 2;
  const options = couple && extras.coupleOptions?.length ? extras.coupleOptions : optionsFor(question, answers);
  const yes = options.find((o) => o.value === "yes") ?? options[0];
  const no = options.find((o) => o.value === "no") ?? options[1];
  const raw = answerOf(answers, question);
  const current: unknown[] = Array.isArray(raw) ? raw : [];

  const set = (index: number, value: boolean) => {
    const next = [...current];
    next[index] = value;
    onChange(patchFor(question, next));
  };

  return (
    <StepFrame heading={(couple && extras.coupleTitle) || question.title} help={question.help ?? undefined}>
      <div className="space-y-6">
        {Array.from({ length: people }, (_, i) => (
          <div key={i}>
            {couple && extras.personLabels?.[i] && (
              <p className="mb-2 text-xs uppercase tracking-wider text-navy-muted">{extras.personLabels[i]}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionCard
                name={`${question.answer_key}-${i}`}
                value="yes"
                checked={current[i] === true}
                onChange={() => set(i, true)}
                label={yes?.label ?? "Yes"}
                compact
              />
              <OptionCard
                name={`${question.answer_key}-${i}`}
                value="no"
                checked={current[i] === false}
                onChange={() => set(i, false)}
                label={no?.label ?? "No"}
                compact
              />
            </div>
          </div>
        ))}
      </div>
    </StepFrame>
  );
}
