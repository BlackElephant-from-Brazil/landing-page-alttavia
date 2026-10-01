import { SelectField } from "@/components/apply/ui/select-field";
import { StepFrame } from "@/components/apply/ui/step-frame";
import { blockedCountryMessage } from "@/content/apply";
import { COUNTRIES } from "@/lib/apply/countries";
import { extrasOf, peopleCount } from "@/lib/apply/questions";
import { countryIssue } from "@/lib/apply/rules";
import { answerOf, patchFor, type StepProps } from "./types";

const OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

/**
 * Kind `per-person-country`: one country select per applicant, stored as
 * `string[]` of ISO codes. `extras.personLabels` labels the selects,
 * `extras.coupleTitle` replaces the title for two applicants.
 *
 * On the passport question, a country on the owner's block list prints its
 * line under that person's select and keeps Continue off through the step's
 * `isValid` (src/lib/apply/rules.ts).
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

  const errorFor = (value: unknown): string | undefined =>
    typeof value === "string" && countryIssue(question.answer_key, value, answers) === "blocked"
      ? blockedCountryMessage(question.answer_key, value)
      : undefined;

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
            error={errorFor(current[i])}
          />
        ))}
      </div>
    </StepFrame>
  );
}
