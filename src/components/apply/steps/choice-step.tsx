import { Check } from "lucide-react";
import { OptionCard } from "@/components/apply/ui/option-card";
import { SelectField } from "@/components/apply/ui/select-field";
import { StepFrame } from "@/components/apply/ui/step-frame";
import { extrasOf, optionsFor } from "@/lib/apply/questions";
import type { Answers } from "@/lib/apply/types";
import { cn } from "@/lib/cn";
import { answerOf, patchFor, type StepProps } from "./types";

/**
 * Kind `choice`: radio cards, or a select when `extras.control` is "select"
 * (the visa list is eleven entries long). An `extras.childrenCheckbox` adds
 * a checkbox under the cards that writes its own answer key.
 */
export function ChoiceStep({ question, answers, onChange }: StepProps) {
  const extras = extrasOf(question);
  const options = optionsFor(question, answers);
  const value = answerOf(answers, question);
  const current = typeof value === "string" ? value : undefined;
  const checkbox = extras.childrenCheckbox;
  const checked = checkbox ? (answers as Record<string, unknown>)[checkbox.key] === true : false;

  return (
    <StepFrame heading={question.title} help={question.help ?? undefined}>
      {extras.control === "select" ? (
        <SelectField
          label={extras.label ?? ""}
          placeholder={extras.placeholder ?? ""}
          options={options}
          value={current}
          onChange={(v) => onChange(patchFor(question, v))}
          className="max-w-md"
        />
      ) : (
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
      )}

      {checkbox && (
        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-sm px-1 py-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange({ [checkbox.key]: e.target.checked } as Partial<Answers>)}
            className="sr-only"
          />
          <span
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-xs border transition-colors duration-200",
              checked ? "border-gold bg-gold text-navy" : "border-navy/25 bg-white"
            )}
            aria-hidden
          >
            {checked && <Check className="size-3" strokeWidth={3} />}
          </span>
          <span>
            <span className="block text-[0.95rem] font-medium text-navy">{checkbox.label}</span>
            {checkbox.help && <span className="block text-[0.82rem] text-navy-muted">{checkbox.help}</span>}
          </span>
        </label>
      )}
    </StepFrame>
  );
}
