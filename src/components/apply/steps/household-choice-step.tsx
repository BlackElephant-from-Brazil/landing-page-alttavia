import { OptionCard } from "@/components/apply/ui/option-card";
import { StepFrame } from "@/components/apply/ui/step-frame";
import { optionsFor } from "@/lib/apply/questions";
import { answerOf, patchFor, type StepProps } from "./types";

/** Kind `choice-by-household`: radio cards from `options.one` or `options.two`, one value stored. */
export function HouseholdChoiceStep({ question, answers, onChange }: StepProps) {
  const options = optionsFor(question, answers);
  const value = answerOf(answers, question);
  const current = typeof value === "string" ? value : undefined;

  return (
    <StepFrame heading={question.title} help={question.help ?? undefined}>
      <div className="grid gap-3">
        {options.map((option) => (
          <OptionCard
            key={option.value}
            name={question.answer_key}
            value={option.value}
            checked={current === option.value}
            onChange={(v) => onChange(patchFor(question, v))}
            label={option.label}
            hint={option.description}
          />
        ))}
      </div>
    </StepFrame>
  );
}
