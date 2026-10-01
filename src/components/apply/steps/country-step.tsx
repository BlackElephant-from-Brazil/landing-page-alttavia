import { Check } from "lucide-react";
import { useId } from "react";
import { SelectField } from "@/components/apply/ui/select-field";
import { StepFrame } from "@/components/apply/ui/step-frame";
import { applyCopy, blockedCountryMessage } from "@/content/apply";
import { COUNTRIES } from "@/lib/apply/countries";
import { extrasOf } from "@/lib/apply/questions";
import { countryIssue, CRIMEA_COUNTRY } from "@/lib/apply/rules";
import { cn } from "@/lib/cn";
import { answerOf, patchFor, type StepProps } from "./types";

const OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

/**
 * Kind `country`: one select of countries, the answer is an ISO code.
 *
 * On the address question (`residence`), a country on the owner's block list
 * prints its line under the select, and Ukraine adds the required Crimea
 * confirmation; both keep Continue off through the step's `isValid`
 * (src/lib/apply/rules.ts).
 */
export function CountryStep({ question, answers, onChange }: StepProps) {
  const extras = extrasOf(question);
  const value = answerOf(answers, question);
  const code = typeof value === "string" ? value : undefined;
  const issue = code ? countryIssue(question.answer_key, code, answers) : undefined;
  const askCrimea = question.answer_key === "residence" && code?.toUpperCase() === CRIMEA_COUNTRY;
  const confirmed = answers.notCrimea === true;
  const crimeaHintId = useId();

  return (
    <StepFrame heading={question.title} help={question.help ?? undefined}>
      <SelectField
        label={extras.label ?? ""}
        placeholder={extras.placeholder ?? ""}
        options={OPTIONS}
        value={code}
        onChange={(next) => onChange(patchFor(question, next))}
        className="max-w-md"
        error={issue === "blocked" && code ? blockedCountryMessage(question.answer_key, code) : undefined}
      />

      <div aria-live="polite">
        {askCrimea && (
          // The hint sits outside the label, so a screen reader reads it once,
          // as the description, and not again inside the checkbox's name.
          <div className="mt-6 max-w-md">
            <label className="flex cursor-pointer items-start gap-3 rounded-sm px-1 py-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold">
              <input
                type="checkbox"
                required
                checked={confirmed}
                onChange={(e) => onChange({ notCrimea: e.target.checked })}
                aria-describedby={crimeaHintId}
                className="sr-only"
              />
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-xs border transition-colors duration-200",
                  confirmed ? "border-gold bg-gold text-navy" : "border-navy/25 bg-white"
                )}
                aria-hidden
              >
                {confirmed && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className="block text-[0.95rem] font-medium text-navy">{applyCopy.blocked.crimeaCheckbox}</span>
            </label>
            <p id={crimeaHintId} className="pl-9 text-[0.82rem] text-navy-muted">
              {applyCopy.blocked.crimea}
            </p>
          </div>
        )}
      </div>
    </StepFrame>
  );
}
