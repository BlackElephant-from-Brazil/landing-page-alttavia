import { SelectField } from "@/components/apply/ui/select-field";
import { StepFrame } from "@/components/apply/ui/step-frame";
import { COUNTRIES } from "@/lib/apply/countries";
import { extrasOf } from "@/lib/apply/questions";
import { answerOf, patchFor, type StepProps } from "./types";

const OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

/** Kind `country`: one select of countries, the answer is an ISO code. */
export function CountryStep({ question, answers, onChange }: StepProps) {
  const extras = extrasOf(question);
  const value = answerOf(answers, question);
  return (
    <StepFrame heading={question.title} help={question.help ?? undefined}>
      <SelectField
        label={extras.label ?? ""}
        placeholder={extras.placeholder ?? ""}
        options={OPTIONS}
        value={typeof value === "string" ? value : undefined}
        onChange={(code) => onChange(patchFor(question, code))}
        className="max-w-md"
      />
    </StepFrame>
  );
}
