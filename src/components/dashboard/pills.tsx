import { cn } from "@/lib/cn";
import type { UserServiceRow } from "@/lib/db/types";

/**
 * The small status pills the client area shares: the payment state of an
 * order in the tables and the modal header, and the generic shape behind it
 * (the same one the document slots draw).
 */

export type PillTone = "muted" | "gold" | "navy" | "clay";

const TONE: Record<PillTone, string> = {
  muted: "bg-navy/5 text-navy-soft",
  gold: "bg-gold/15 text-[#7A5A12]",
  navy: "bg-navy text-white",
  clay: "bg-clay/10 text-[#B52D25]",
};

export function Pill({ tone, children, className }: { tone: PillTone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 text-[0.72rem] font-medium uppercase tracking-[0.14em]",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const PAYMENT_LABEL = {
  paid: "Paid",
  awaiting: "Awaiting payment",
} as const;

/** "Paid" once `paid_at` is set, "Awaiting payment" before. */
export function PaymentPill({ order, className }: { order: Pick<UserServiceRow, "paid_at">; className?: string }) {
  return order.paid_at ? (
    <Pill tone="navy" className={className}>
      {PAYMENT_LABEL.paid}
    </Pill>
  ) : (
    <Pill tone="gold" className={className}>
      {PAYMENT_LABEL.awaiting}
    </Pill>
  );
}
