import { SelectField } from "@/components/apply/ui/select-field";
import { StepFrame } from "@/components/apply/ui/step-frame";
import { COUNTRIES } from "@/lib/apply/countries";
import { extrasOf, peopleCount } from "@/lib/apply/questions";
import { answerOf, patchFor, type StepProps } from "./types";

const OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

/**
 * Kind `per-person-country`: one country select per applicant, stored as
 * `string[]` of ISO codes. `extras.personLabels` labels the selects,
 * `extras.coupleTitle` replaces the title for two applicants.
 */
export function PerPersonCountryStep({ question, answers, onChange }: StepProps) {
  const extras = extrasOf(question);
  const people = peopleCount(answers);
  const couple = people === 2;
  const raw = answerOf(answers, question);
  const current: unknown[] = Array.isArray(raw) ? raw : [];

  const set = (index: number, value: string) => {
    const next = [...current];
    next[index] = value;
    onChange(patchFor(question, next));
  };

  return (
    <StepFrame heading={(couple && extras.coupleTitle) || question.title} help={question.help ?? undefined}>
      <div className="grid max-w-md gap-5">
        {Array.from({ length: people }, (_, i) => (
          <SelectField
            key={i}
            label={extras.personLabels?.[i] ?? extras.label ?? ""}
            placeholder={extras.placeholder ?? ""}
            options={OPTIONS}
            value={typeof current[i] === "string" ? (current[i] as string) : undefined}
            onChange={(v) => set(i, v)}
          />
        ))}
      </div>
    </StepFrame>
  );
}
