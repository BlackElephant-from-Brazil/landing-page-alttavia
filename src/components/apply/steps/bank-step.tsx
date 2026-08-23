import { OptionCard } from "@/components/apply/ui/option-card";
import { StepFrame } from "@/components/apply/ui/step-frame";
import { applyCopy } from "@/content/apply";
import { BANK_OPTIONS_COUPLE, BANK_OPTIONS_SINGLE, peopleCount } from "@/lib/apply/steps";
import type { BankChoice } from "@/lib/apply/types";
import type { StepProps } from "./types";

export function BankStep({ answers, onChange }: StepProps) {
  const copy = applyCopy.steps.bank;
  const options = peopleCount(answers) === 2 ? BANK_OPTIONS_COUPLE : BANK_OPTIONS_SINGLE;

  return (
    <StepFrame heading={copy.heading} help={copy.help}>
      <div className="grid gap-3">
        {options.map((value) => (
          <OptionCard
            key={value}
            name="bank"
            value={value}
            checked={answers.bank === value}
            onChange={(v) => onChange({ bank: v as BankChoice })}
            label={copy.options[value].label}
            hint={copy.options[value].hint}
          />
        ))}
      </div>
    </StepFrame>
  );
}
