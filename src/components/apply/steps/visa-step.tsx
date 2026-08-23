import { SelectField } from "@/components/apply/ui/select-field";
import { StepFrame } from "@/components/apply/ui/step-frame";
import { applyCopy } from "@/content/apply";
import { VISA_OPTIONS } from "@/lib/apply/steps";
import type { Visa } from "@/lib/apply/types";
import type { StepProps } from "./types";

const OPTIONS = VISA_OPTIONS.map((value) => ({ value, label: applyCopy.steps.visa.options[value] }));

export function VisaStep({ answers, onChange }: StepProps) {
  const copy = applyCopy.steps.visa;
  return (
    <StepFrame heading={copy.heading} help={copy.help}>
      <SelectField
        label={copy.label}
        placeholder={copy.placeholder}
        options={OPTIONS}
        value={answers.visa}
        onChange={(visa) => onChange({ visa: visa as Visa })}
        className="max-w-md"
      />
    </StepFrame>
  );
}
