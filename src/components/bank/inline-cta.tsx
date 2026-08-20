import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";

type InlineCtaProps = {
  text: string;
  cta: string;
  href: string;
  note?: string;
};

/**
 * A slim band, not a section. Deliberately short so it reads as a signpost on
 * the way down rather than as another pitch, and it points at the pricing table
 * instead of at Stripe: a reader this far up still wants the number first.
 */
export function InlineCta({ text, cta, href, note }: InlineCtaProps) {
  return (
    <aside className="bg-white">
      <Container size="wide">
        <Reveal>
          <div className="flex flex-col items-center gap-4 border-y border-navy/10 py-6 text-center sm:flex-row sm:justify-between sm:gap-8 sm:text-left">
            <div>
              <p className="font-serif text-lg leading-snug text-navy sm:text-xl">
                {text}
              </p>
              {note && (
                <p className="mt-1.5 text-[0.78rem] text-navy-muted">{note}</p>
              )}
            </div>
            <ButtonLink
              href={href}
              size="md"
              className="w-full shrink-0 sm:w-auto"
            >
              {cta}
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </aside>
  );
}
