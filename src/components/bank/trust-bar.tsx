import Image from "next/image";
import { Container } from "@/components/ui/container";
import { bankNif, press } from "@/content/bank-nif";

/**
 * Section 3. The press logos link to the real articles, because proof a reader
 * can check is worth twice as much as proof they have to take on faith.
 */
export function TrustBar() {
  const { trustBar } = bankNif;

  return (
    <section className="border-y border-navy/8 bg-white">
      <Container size="wide" className="py-5 lg:py-6">
        <div className="flex flex-col items-center gap-5 lg:flex-row lg:justify-between lg:gap-8">
          <ul className="flex flex-col items-center gap-2.5 text-center text-[0.82rem] text-navy-soft sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-4 lg:justify-start lg:text-left">
            {trustBar.items.map((item, i) => (
              <li key={item} className="flex items-center gap-4">
                {i > 0 && (
                  <span
                    className="hidden size-1 rounded-full bg-gold sm:inline-block"
                    aria-hidden
                  />
                )}
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-5 sm:gap-7">
            <span className="text-[0.66rem] font-medium uppercase tracking-[0.22em] text-navy-muted">
              {trustBar.pressLabel}
            </span>
            {press.map((outlet) => (
              <a
                key={outlet.name}
                href={outlet.href}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-70 transition-opacity duration-200 hover:opacity-100"
                aria-label={`Read the ${outlet.name} article`}
              >
                <Image
                  src={outlet.src}
                  alt={outlet.name}
                  width={outlet.width}
                  height={outlet.height}
                  className={outlet.className}
                />
              </a>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
