import type { SummaryItem } from "@/lib/apply/summary";

/**
 * "Your answers": the questions the client answered in the wizard and what
 * they said, as a two column definition list. Rows come from
 * `summarizeAnswers` in src/lib/apply/summary.ts, already in question order
 * and already in plain English.
 */
export function AnswersSummary({ items }: { items: SummaryItem[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="answers-heading">
      <h2 id="answers-heading" className="text-xs uppercase tracking-wider text-navy-muted">
        Your answers
      </h2>
      <dl className="mt-4 divide-y divide-navy/10 rounded-lg border border-navy/10 bg-white shadow-[var(--shadow-soft)]">
        {items.map((item, i) => (
          <div key={`${item.label}-${i}`} className="grid gap-1 px-5 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:gap-6">
            <dt className="text-[0.9rem] leading-relaxed text-navy-soft">{item.label}</dt>
            <dd className="text-[0.95rem] font-medium leading-relaxed text-navy">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
