import { Check, FileText, Info, MessageCircle } from "lucide-react";
import { RichText } from "@/components/bank/rich-text";
import { ButtonLink } from "@/components/ui/button";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import {
  applyCopy,
  documentsFor,
  includesFor,
  orderName,
  orderTotal,
  PRODUCTS,
  whatsappMessage,
  whatsappUrl,
} from "@/content/apply";
import { totalCents } from "@/lib/apply/recommend";
import type { Answers, Recommendation } from "@/lib/apply/types";

type ProductRecommendation = Extract<Recommendation, { kind: "product" }>;

/**
 * The last screen: one product, the reasons it was chosen, the notes that
 * apply to this household, and the handoff. Markup follows the featured card
 * on the landing's pricing section so the two read as one product.
 */
export function ResultCard({
  rec,
  answers,
  onStartOver,
}: {
  rec: ProductRecommendation;
  answers: Answers;
  onStartOver: () => void;
}) {
  const copy = applyCopy.result;
  const product = PRODUCTS[rec.product];
  const total = orderTotal(rec);
  const picked = rec.preselected ? PRODUCTS[rec.preselected] : undefined;
  const href = whatsappUrl(whatsappMessage(rec, answers));

  return (
    <div>
      <EyebrowSolo>{copy.eyebrow}</EyebrowSolo>
      <h2
        tabIndex={-1}
        className="mt-4 font-serif text-[clamp(1.6rem,3.3vw,2.25rem)] leading-tight text-balance text-navy outline-none"
      >
        {copy.heading}
      </h2>

      {picked && (
        <p className="mt-5 flex items-start gap-3 rounded-sm border border-gold/40 bg-gold/10 px-4 py-3 text-[0.92rem] leading-relaxed text-navy">
          <Info className="mt-0.5 size-4 shrink-0 text-gold-dark" aria-hidden />
          <span>
            <RichText text={copy.divergence(picked.name, product.name)} />
          </span>
        </p>
      )}

      <article className="relative mt-8 flex flex-col rounded-lg bg-navy p-7 text-white shadow-[var(--shadow-card)] ring-2 ring-gold sm:p-8">
        <h3 className="font-serif text-xl text-white">{orderName(rec)}</h3>
        <p className="mt-1.5 text-sm leading-snug text-white/65">{product.summary}</p>

        <p className="mt-6 font-serif text-5xl leading-none text-white">{total}</p>
        <p className="mt-3 text-[0.8rem] text-white/55">{product.time}</p>

        <ul className="mt-6 space-y-3">
          {includesFor(rec).map((feature) => (
            <li key={feature} className="flex gap-3">
              <Check className="mt-0.5 size-4 shrink-0 text-gold-light" aria-hidden />
              <span className="text-[0.92rem] leading-relaxed text-white/80">
                <RichText text={feature} />
              </span>
            </li>
          ))}
        </ul>

        <ButtonLink
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          size="lg"
          variant="gold"
          className="mt-8 w-full"
        >
          <MessageCircle className="size-4" aria-hidden />
          {copy.cta(total)}
        </ButtonLink>
        <p className="mt-3 text-center text-[0.78rem] leading-relaxed text-white/55">{copy.ctaHint}</p>
      </article>

      <section className="mt-8">
        <h3 className="text-xs uppercase tracking-wider text-navy-muted">{copy.whyTitle}</h3>
        <ul className="mt-3 space-y-2.5">
          {rec.reasons.map((id) => (
            <li key={id} className="flex gap-3 text-[0.95rem] leading-relaxed text-navy-soft">
              <span className="mt-2.5 inline-block size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
              <span>{applyCopy.reasons[id]}</span>
            </li>
          ))}
        </ul>
      </section>

      {rec.notes.length > 0 && (
        <section className="mt-6 space-y-3">
          {rec.notes.map((id) => (
            <p
              key={id}
              className="flex items-start gap-3 rounded-sm border border-navy/10 bg-white px-4 py-3 text-[0.9rem] leading-relaxed text-navy-soft"
            >
              <Info className="mt-0.5 size-4 shrink-0 text-gold-dark" aria-hidden />
              <span>{applyCopy.notes[id]}</span>
            </p>
          ))}
        </section>
      )}

      <section className="mt-8">
        <h3 className="text-xs uppercase tracking-wider text-navy-muted">{copy.docsTitle}</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {documentsFor(rec, answers).map((doc) => (
            <li
              key={doc}
              className="inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white px-3.5 py-1.5 text-[0.85rem] text-navy"
            >
              <FileText className="size-3.5 text-gold-dark" aria-hidden />
              {doc}
            </li>
          ))}
        </ul>
      </section>

      {(picked || rec.valid.length > 1) && (
        <section className="mt-8">
          <h3 className="text-xs uppercase tracking-wider text-navy-muted">{copy.alternativesTitle}</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            {rec.valid
              .filter((id) => id !== rec.product)
              .map((id) => {
                const alt = PRODUCTS[id];
                const altRec: ProductRecommendation = {
                  ...rec,
                  product: id,
                  quantity: 1,
                  totalCents: totalCents(id, 1),
                };
                const altHref = whatsappUrl(whatsappMessage(altRec, answers));
                return (
                  <ButtonLink
                    key={id}
                    href={altHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outline"
                    size="md"
                  >
                    {picked?.id === id ? copy.keepPicked(alt.name, alt.price) : `${alt.name} · ${alt.price}`}
                  </ButtonLink>
                );
              })}
          </div>
        </section>
      )}

      <p className="mt-8 text-[0.8rem] leading-relaxed text-navy-muted">{copy.footnote}</p>

      <button
        type="button"
        onClick={onStartOver}
        className="mt-4 text-sm font-medium text-navy-soft underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline"
      >
        {copy.startOver}
      </button>
    </div>
  );
}
