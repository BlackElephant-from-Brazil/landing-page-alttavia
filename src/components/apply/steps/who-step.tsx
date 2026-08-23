import { Check } from "lucide-react";
import { OptionCard } from "@/components/apply/ui/option-card";
import { StepFrame } from "@/components/apply/ui/step-frame";
import { applyCopy } from "@/content/apply";
import { APPLICANT_OPTIONS } from "@/lib/apply/steps";
import type { Applicants } from "@/lib/apply/types";
import { cn } from "@/lib/cn";
import type { StepProps } from "./types";

export function WhoStep({ answers, onChange }: StepProps) {
  const copy = applyCopy.steps.who;
  const children = answers.childrenNifs === true;

  return (
    <StepFrame heading={copy.heading}>
      <div className="grid gap-3">
        {APPLICANT_OPTIONS.map((value) => (
          <OptionCard
            key={value}
            name="applicants"
            value={value}
            checked={answers.applicants === value}
            onChange={(v) => onChange({ applicants: v as Applicants })}
            label={copy.options[value].label}
            hint={copy.options[value].hint}
          />
        ))}
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-sm px-1 py-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold">
        <input
          type="checkbox"
          checked={children}
          onChange={(e) => onChange({ childrenNifs: e.target.checked })}
          className="sr-only"
        />
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-xs border transition-colors duration-200",
            children ? "border-gold bg-gold text-navy" : "border-navy/25 bg-white"
          )}
          aria-hidden
        >
          {children && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span>
          <span className="block text-[0.95rem] font-medium text-navy">{copy.children}</span>
          <span className="block text-[0.82rem] text-navy-muted">{copy.childrenHint}</span>
        </span>
      </label>
    </StepFrame>
  );
}
