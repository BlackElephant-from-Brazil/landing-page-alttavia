import { ArrowUpRight, Star } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { bankNif, googleProfileUrl, reviews } from "@/content/bank-nif";

/**
 * Section 10.
 *
 * A review with no text renders as a labeled slot carrying the reviewer's name,
 * never as invented praise. The two names in the content file are real people,
 * and approximating what they wrote is not something this component can do.
 */
export function SocialProof() {
  const { socialProof } = bankNif;

  return (
    <section className="bg-paper py-8 lg:py-12">
      <Container size="wide">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <EyebrowSolo>{socialProof.eyebrow}</EyebrowSolo>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 font-serif text-[clamp(1.7rem,3.3vw,2.4rem)] text-balance text-navy">
              {socialProof.h2}
            </h2>
          </Reveal>
        </div>

        <div className="mx-auto mt-8 grid max-w-4xl gap-6 sm:grid-cols-2 lg:mt-10">
          {reviews.map((review, i) => (
            <Reveal key={review.author} delay={i * 0.08} className="h-full">
              <figure className="flex h-full flex-col rounded-lg border border-navy/10 bg-white p-7 shadow-[var(--shadow-soft)]">
                <div className="flex gap-0.5" aria-label="Five stars">
                  {[0, 1, 2, 3, 4].map((star) => (
                    <Star
                      key={star}
                      className="size-4 fill-gold text-gold"
                      aria-hidden
                    />
                  ))}
                </div>

                <p className="mt-4 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-gold-dark">
                  {review.topic}
                </p>

                {review.text ? (
                  <blockquote className="mt-3 flex-1 text-[0.95rem] leading-relaxed text-navy-soft">
                    {review.text}
                  </blockquote>
                ) : (
                  <div className="mt-3 flex-1 rounded border border-dashed border-navy/20 px-4 py-5">
                    <p className="font-serif text-base text-navy/70">
                      {socialProof.emptyState.title}
                    </p>
                    <p className="mt-2 text-[0.82rem] leading-relaxed text-navy-muted">
                      {socialProof.emptyState.body}
                    </p>
                  </div>
                )}

                <figcaption className="mt-6 flex items-end justify-between gap-4 border-t border-navy/8 pt-4">
                  <div>
                    <p className="font-serif text-lg text-navy">{review.author}</p>
                    <p className="mt-0.5 text-xs text-navy-muted">
                      {socialProof.badge}
                    </p>
                  </div>
                  {/* The card shows a verbatim excerpt, so it says so and points
                      at the published review rather than quietly trimming it. */}
                  {review.text && review.text !== review.fullText && (
                    <a
                      href={googleProfileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-navy-muted underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline"
                    >
                      Read in full
                    </a>
                  )}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.14}>
          <div className="mt-8 text-center">
            <a
              href={googleProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-navy transition-colors duration-200 hover:text-gold-dark"
            >
              {socialProof.profileCta}
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
