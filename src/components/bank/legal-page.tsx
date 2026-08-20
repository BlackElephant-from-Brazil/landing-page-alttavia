import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SiteFooter } from "@/components/bank/site-footer";
import { Logo } from "@/components/ui/logo";

export type LegalBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] };

/**
 * Plain shell for the policy pages the checkout links to. No animation, no
 * decoration: someone reading this wants to find one clause and leave.
 */
export function LegalPage({
  title,
  updated,
  blocks,
}: {
  title: string;
  updated: string;
  blocks: LegalBlock[];
}) {
  return (
    <>
      <header className="border-b border-navy/10 bg-white">
        <Container size="wide" className="flex h-16 items-center justify-between lg:h-20">
          <Link href="/en" aria-label="Back to the main page">
            <Logo className="h-7 w-auto lg:h-8" />
          </Link>
          <Link
            href="/en"
            className="inline-flex items-center gap-2 text-sm font-medium text-navy-soft transition-colors duration-200 hover:text-gold-dark"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to the page
          </Link>
        </Container>
      </header>

      <main className="flex-1 bg-paper py-16 lg:py-24">
        <Container size="narrow">
          <h1 className="font-serif text-[clamp(2rem,4.5vw,2.75rem)] text-navy">
            {title}
          </h1>
          <p className="mt-3 text-sm text-navy-muted">{updated}</p>

          <div className="mt-10 space-y-6">
            {blocks.map((block, i) => {
              if (block.kind === "heading") {
                return (
                  <h2
                    key={i}
                    className="pt-4 font-serif text-2xl text-navy sm:text-[1.75rem]"
                  >
                    {block.text}
                  </h2>
                );
              }
              if (block.kind === "list") {
                return (
                  <ul key={i} className="space-y-3">
                    {block.items.map((item) => (
                      <li
                        key={item}
                        className="flex gap-3 leading-relaxed text-navy-soft"
                      >
                        <span
                          className="mt-2.5 inline-block size-1.5 shrink-0 rounded-full bg-gold"
                          aria-hidden
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={i} className="leading-relaxed text-navy-soft">
                  {block.text}
                </p>
              );
            })}
          </div>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
