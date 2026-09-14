import { Check } from "lucide-react";

import { RichText } from "@/components/bank/rich-text";
import { includesFor } from "@/content/apply";
import { formatEuro } from "@/content/bank-nif";
import { isProductId } from "@/lib/apply/types";
import type { ServiceRow, UserServiceRow } from "@/lib/db/types";

/**
 * What the client ordered, in the same navy card the result screen used to
 * sell it, so the dashboard reads as the next page of the same story.
 *
 * Name, tagline, includes and timeline come from the service row. One case
 * is not the row verbatim: a joint account. For that the feature list is
 * rewritten by `includesFor` in src/content/apply.ts, the same function the
 * result screen uses, so the two never disagree.
 */
export function ServiceCard({ order, service }: { order: UserServiceRow; service: ServiceRow }) {
  const includes = includesForOrder(order, service);

  return (
    <article
      aria-labelledby="service-card-heading"
      className="rounded-lg bg-navy p-7 text-white shadow-[var(--shadow-card)] ring-2 ring-gold sm:p-8"
    >
      <h2 id="service-card-heading" className="text-xs font-medium uppercase tracking-[0.18em] text-gold-light">
        Your package
      </h2>
      <p className="mt-3 font-serif text-xl text-white">{service.name}</p>
      {service.tagline && <p className="mt-1.5 text-sm leading-snug text-white/65">{service.tagline}</p>}

      <p className="mt-6 font-serif text-5xl leading-none text-white">{formatEuro(order.total_cents)}</p>
      {service.timeline && <p className="mt-3 text-[0.8rem] text-white/55">{service.timeline}</p>}

      {includes.length > 0 && (
        <ul className="mt-6 space-y-3">
          {includes.map((feature) => (
            <li key={feature} className="flex gap-3">
              <Check className="mt-0.5 size-4 shrink-0 text-gold-light" aria-hidden />
              <span className="text-[0.92rem] leading-relaxed text-white/80">
                <RichText text={feature} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function includesForOrder(order: UserServiceRow, service: ServiceRow): readonly string[] {
  if (order.joint && isProductId(service.slug)) {
    return includesFor({
      kind: "product",
      product: service.slug,
      totalCents: order.total_cents,
      joint: order.joint,
      valid: [service.slug],
      reasons: [],
      notes: [],
    });
  }
  return Array.isArray(service.includes) ? service.includes : [];
}
