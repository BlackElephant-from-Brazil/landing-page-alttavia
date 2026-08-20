import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { RichText } from "@/components/bank/rich-text";
import { bankNif } from "@/content/bank-nif";

/**
 * Section 5. The two columns are mirrored on purpose: rule, then the things
 * people try, then the dead end. Listing the failed workarounds here means the
 * reader has already discarded them before they go and search for one.
 */
export function Wedge() {
  const { wedge } = bankNif;

  return (
    <section className="relative overflow-hidden bg-navy py-20 text-white lg:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-0 h-[460px] w-[460px] rounded-full opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.55) 0%, transparent 68%)",
        }}
      />

      <Container size="wide" className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="flex items-center justify-center gap-3 text-[0.72rem] font-medium uppercase tracking-[0.28em] text-gold-light">
              <span className="inline-block h-px w-8 bg-gold/70" aria-hidden />
              <span>{wedge.eyebrow}</span>
              <span className="inline-block h-px w-8 bg-gold/70" aria-hidden />
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-5 font-serif text-[clamp(1.7rem,3.3vw,2.4rem)] text-balance text-white">{wedge.h2}</h2>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-4 font-serif text-xl italic text-gold-light sm:text-2xl">
              {wedge.h2Sub}
            </p>
          </Reveal>
        </div>

        <div className="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-2 lg:gap-8">
          {wedge.columns.map((column, i) => (
            <Reveal key={column.title} delay={0.1 + i * 0.1}>
              <article className="glass-card h-full rounded-lg p-7 sm:p-9">
                <p className="font-serif text-sm tracking-[0.2em] text-gold-light">
                  {column.kicker}
                </p>
                <h3 className="mt-3 font-serif text-2xl text-white sm:text-[1.75rem]">
                  {column.title}
                </h3>
                <p className="mt-4 leading-relaxed text-white/75">
                  <RichText text={column.body} />
                </p>

                <p className="mt-6 text-[0.68rem] font-medium uppercase tracking-[0.22em] text-white/45">
                  {column.listTitle}
                </p>
                <ul className="mt-3.5 space-y-3">
                  {column.list.map((item) => (
                    <li key={item} className="flex gap-3 text-[0.95rem] leading-relaxed text-white/75">
                      <span
                        className="mt-2.5 inline-block size-1.5 shrink-0 rounded-full bg-gold"
                        aria-hidden
                      />
                      <span>
                        <RichText text={item} />
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.15}>
          <p className="mx-auto mt-8 max-w-2xl text-center font-serif text-xl leading-snug text-balance text-white sm:text-2xl lg:mt-10">
            {wedge.closing}
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
