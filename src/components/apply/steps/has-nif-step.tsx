import { OptionCard } from "@/components/apply/ui/option-card";
import { StepFrame } from "@/components/apply/ui/step-frame";
import { applyCopy } from "@/content/apply";
import { peopleCount } from "@/lib/apply/steps";
import type { StepProps } from "./types";

export function HasNifStep({ answers, onChange }: StepProps) {
  const copy = applyCopy.steps.hasNif;
  const people = peopleCount(answers);

  const set = (index: number, value: boolean) => {
    const next = [...(answers.hasNif ?? [])];
    next[index] = value;
    onChange({ hasNif: next });
  };

  return (
    <StepFrame heading={people === 2 ? copy.headingCouple : copy.heading} help={copy.help}>
      <div className="space-y-6">
        {Array.from({ length: people }, (_, i) => (
          <div key={i}>
            {people === 2 && (
              <p className="mb-2 text-xs uppercase tracking-wider text-navy-muted">{copy.person[i]}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionCard
                name={`hasNif-${i}`}
                value="yes"
                checked={answers.hasNif?.[i] === true}
                onChange={() => set(i, true)}
                label={people === 2 ? copy.yesPartner : copy.yes}
                compact
              />
              <OptionCard
                name={`hasNif-${i}`}
                value="no"
                checked={answers.hasNif?.[i] === false}
                onChange={() => set(i, false)}
                label={people === 2 ? copy.noPartner : copy.no}
                compact
              />
            </div>
          </div>
        ))}
      </div>
    </StepFrame>
  );
}
