import { Check, X } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { bankNif } from "@/content/bank-nif";

/**
 * Section 9. This table is the whole answer to the price objection, and the
 * last row quietly plants the lifetime value: the same firm is still there for
 * residency, taxes and renewals. It sells nothing yet.
 *
 * Below `lg` a table cannot be read without pinching, so the same rows render
 * as stacked cards.
 */
export function Comparison() {
  const { comparison } = bankNif;
  const [themLabel, usLabel] = comparison.columns;

  return (
    <section className="bg-white py-8 lg:py-12">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <EyebrowSolo>{comparison.eyebrow}</EyebrowSolo>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 font-serif text-[clamp(1.7rem,3.3vw,2.4rem)] text-balance text-navy">
              {comparison.h2}
            </h2>
          </Reveal>
        </div>

        {/* Desktop */}
        <Reveal delay={0.12}>
          <div className="mt-8 hidden overflow-hidden rounded-lg border border-navy/10 lg:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-paper">
                  <th className="w-[26%] px-6 py-5" />
                  <th className="w-[37%] px-6 py-5 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-navy-muted">
                    {themLabel}
                  </th>
                  <th className="w-[37%] bg-navy px-6 py-5 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-gold-light">
                    {usLabel}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr key={row.label} className="border-t border-navy/8">
                    <th
                      scope="row"
                      className="px-6 py-5 align-top text-sm font-medium text-navy"
                    >
                      {row.label}
                    </th>
                    <td className="px-6 py-5 align-top text-[0.95rem] text-navy-muted">
                      <span className="flex gap-3">
                        <X className="mt-1 size-4 shrink-0 text-navy-muted/60" aria-hidden />
                        {row.them}
                      </span>
                    </td>
                    <td className="bg-navy/[0.03] px-6 py-5 align-top text-[0.95rem] font-medium text-navy">
                      <span className="flex gap-3">
                        <Check className="mt-1 size-4 shrink-0 text-gold-dark" aria-hidden />
                        {row.us}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        {/* Mobile and tablet */}
        <div className="mt-8 space-y-4 lg:hidden">
          {comparison.rows.map((row, i) => (
            <Reveal key={row.label} delay={i * 0.06}>
              <div className="overflow-hidden rounded-lg border border-navy/10">
                <p className="bg-paper px-5 py-3 text-sm font-medium text-navy">
                  {row.label}
                </p>
                <div className="space-y-4 px-5 py-5">
                  <div>
                    <p className="text-[0.66rem] font-medium uppercase tracking-[0.18em] text-navy-muted">
                      {themLabel}
                    </p>
                    <p className="mt-1.5 flex gap-2.5 text-[0.92rem] leading-relaxed text-navy-muted">
                      <X className="mt-1 size-3.5 shrink-0 text-navy-muted/60" aria-hidden />
                      {row.them}
                    </p>
                  </div>
                  <div className="border-t border-navy/8 pt-4">
                    <p className="text-[0.66rem] font-medium uppercase tracking-[0.18em] text-gold-dark">
                      {usLabel}
                    </p>
                    <p className="mt-1.5 flex gap-2.5 text-[0.92rem] font-medium leading-relaxed text-navy">
                      <Check className="mt-1 size-3.5 shrink-0 text-gold-dark" aria-hidden />
                      {row.us}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
