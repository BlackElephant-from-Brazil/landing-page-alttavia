import { useEffect, useRef } from "react";
import { ArrowRight, Check, FileText, Info } from "lucide-react";
import { RichText } from "@/components/bank/rich-text";
import { Button } from "@/components/ui/button";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import {
  alternativeFor,
  applyCopy,
  documentsFor,
  includesFor,
  orderName,
  orderTotal,
  serviceFor,
} from "@/content/apply";
import type { Answers, ProductId, Recommendation } from "@/lib/apply/types";
import type { ServiceRow } from "@/lib/db/types";

type ProductRecommendation = Extract<Recommendation, { kind: "product" }>;

/**
 * The last screen: one product, the reasons it was chosen, the notes that
 * apply to this household, and the handoff to the client area. Markup follows
 * the featured card on the landing's pricing section so the two read as one
 * product.
 *
 * Name, tagline, includes and timeline come from the service row for the
 * product (the database's, or the fallback built from the pricing cards).
 * Prices come from the engine, never from the row, so a stale row cannot
 * change what is charged: the server prices the order again on submit.
 *
 * The buttons do not link anywhere. They hand the chosen product to the
 * wizard, which creates the account (or finds the session) and posts the
 * order. Alternatives are one unit each, like the main recommendation: every
 * service sells one unit per purchase.
 */
export function ResultCard({
  rec,
  answers,
  services,
  pending,
  error,
  onCheckout,
  onStartOver,
}: {
  rec: ProductRecommendation;
  answers: Answers;
  services: readonly ServiceRow[];
  /** A submit is in flight for the signed in visitor. */
  pending: boolean;
  /** The last submit failed; shown under the button. */
  error: string | null;
  onCheckout: (product: ProductId) => void;
  onStartOver: () => void;
}) {
  const copy = applyCopy.result;
  const service = serviceFor(services, rec.product);
  const total = orderTotal(rec);
  const picked = rec.preselected ? serviceFor(services, rec.preselected) : undefined;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The screen replaces a question; a screen reader hears the result instead
  // of staying on a button that no longer exists.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div>
      <EyebrowSolo>{copy.eyebrow}</EyebrowSolo>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-4 font-serif text-[clamp(1.6rem,3.3vw,2.25rem)] leading-tight text-balance text-navy outline-none"
      >
        {copy.heading}
      </h2>

      {picked && (
        <p className="mt-5 flex items-start gap-3 rounded-sm border border-gold/40 bg-gold/10 px-4 py-3 text-[0.92rem] leading-relaxed text-navy">
          <Info className="mt-0.5 size-4 shrink-0 text-gold-dark" aria-hidden />
          <span>
            <RichText text={copy.divergence(picked.name, service.name)} />
          </span>
        </p>
      )}

      <article className="relative mt-8 flex flex-col rounded-lg bg-navy p-7 text-white shadow-[var(--shadow-card)] ring-2 ring-gold sm:p-8">
        <h3 className="font-serif text-xl text-white">{orderName(rec, service)}</h3>
        {service.tagline && <p className="mt-1.5 text-sm leading-snug text-white/65">{service.tagline}</p>}

        <p className="mt-6 font-serif text-5xl leading-none text-white">{total}</p>
        {service.timeline && <p className="mt-3 text-[0.8rem] text-white/55">{service.timeline}</p>}

        <ul className="mt-6 space-y-3">
          {includesFor(rec, service).map((feature) => (
            <li key={feature} className="flex gap-3">
              <Check className="mt-0.5 size-4 shrink-0 text-gold-light" aria-hidden />
              <span className="text-[0.92rem] leading-relaxed text-white/80">
                <RichText text={feature} />
              </span>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          onClick={() => onCheckout(rec.product)}
          disabled={pending}
          aria-busy={pending}
          size="lg"
          variant="gold"
          className="mt-8 w-full"
        >
          {pending ? copy.ctaPending : copy.cta(total)}
          {!pending && <ArrowRight className="size-4" aria-hidden />}
        </Button>
        {error ? (
          <p role="alert" className="mt-3 text-center text-[0.85rem] leading-relaxed text-gold-light">
            {error}
          </p>
        ) : (
          <p className="mt-3 text-center text-[0.78rem] leading-relaxed text-white/55">{copy.ctaHint}</p>
        )}
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
          {documentsFor(rec).map((doc) => (
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
                const alt = alternativeFor(rec, id, answers);
                const altService = serviceFor(services, id);
                const name = orderName(alt, altService);
                const price = orderTotal(alt);
                return (
                  <Button
                    key={id}
                    type="button"
                    variant="outline"
                    size="md"
                    disabled={pending}
                    onClick={() => onCheckout(id)}
                  >
                    {picked?.slug === id ? copy.keepPicked(name, price) : `${name} · ${price}`}
                  </Button>
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
