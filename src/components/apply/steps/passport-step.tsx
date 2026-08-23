import { SelectField } from "@/components/apply/ui/select-field";
import { StepFrame } from "@/components/apply/ui/step-frame";
import { applyCopy } from "@/content/apply";
import { COUNTRIES } from "@/lib/apply/countries";
import { peopleCount } from "@/lib/apply/steps";
import type { StepProps } from "./types";

const OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

export function PassportStep({ answers, onChange }: StepProps) {
  const copy = applyCopy.steps.passport;
  const people = peopleCount(answers);

  const set = (index: number, value: string) => {
    const next = [...(answers.passport ?? [])];
    next[index] = value;
    onChange({ passport: next });
  };

  return (
    <StepFrame heading={people === 2 ? copy.headingCouple : copy.heading} help={copy.help}>
      <div className="grid max-w-md gap-5">
        {Array.from({ length: people }, (_, i) => (
          <SelectField
            key={i}
            label={copy.person[i]}
            placeholder={copy.placeholder}
            options={OPTIONS}
            value={answers.passport?.[i]}
            onChange={(v) => set(i, v)}
          />
        ))}
      </div>
    </StepFrame>
  );
}
