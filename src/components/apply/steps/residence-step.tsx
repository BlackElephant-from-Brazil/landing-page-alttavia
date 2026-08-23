import { SelectField } from "@/components/apply/ui/select-field";
import { StepFrame } from "@/components/apply/ui/step-frame";
import { applyCopy } from "@/content/apply";
import { COUNTRIES } from "@/lib/apply/countries";
import type { StepProps } from "./types";

const OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

export function ResidenceStep({ answers, onChange }: StepProps) {
  const copy = applyCopy.steps.residence;
  return (
    <StepFrame heading={copy.heading} help={copy.help}>
      <SelectField
        label={copy.label}
        placeholder={copy.placeholder}
        options={OPTIONS}
        value={answers.residence}
        onChange={(residence) => onChange({ residence })}
        className="max-w-md"
      />
    </StepFrame>
  );
}
