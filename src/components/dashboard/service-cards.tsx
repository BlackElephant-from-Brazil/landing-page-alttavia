"use client";

import { Check } from "lucide-react";
import { useRef, useState } from "react";

import { RichText } from "@/components/bank/rich-text";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/content/bank-nif";
import { cn } from "@/lib/cn";
import type { ServiceRow } from "@/lib/db/types";

import { PurchaseDrawer } from "./purchase-drawer";

/**
 * The service cards the client area sells from: the three on the dashboard
 * home and the full gallery on /en/dashboard/services. One card per active
 * service with its name, tagline, price, first three includes and timeline,
 * then two stacked buttons, See details above Buy, both opening the
 * purchase drawer for that service.
 *
 * Client component because which drawer is open is local state, not the
 * URL: a drawer is a quick look and a purchase, not a place to link to.
 * The page loads the rows and the document labels on the server and hands
 * them over as plain props.
 *
 * No quantity choice: every service sells one unit per purchase. And no
 * "you already have this one" warning: this is the shop, and a second NIF
 * or a second account is a second purchase.
 */

const INCLUDES_SHOWN = 3;

const copy = {
  details: "See details",
  buy: (price: string) => `Buy for ${price}`,
  detailsAria: (name: string) => `See details of ${name}`,
  buyAria: (name: string, price: string) => `Buy ${name} for ${price}`,
  empty: "Nothing to order right now.",
} as const;

export function ServiceCards({
  services,
  docLabels,
  columns = 3,
}: {
  services: readonly ServiceRow[];
  /** Labels of the documents each service asks for, keyed by service id. */
  docLabels: Readonly<Record<string, readonly string[]>>;
  columns?: 2 | 3;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const open = services.find((s) => s.id === openId) ?? null;

  function show(service: ServiceRow, from: HTMLElement) {
    opener.current = from;
    setOpenId(service.id);
  }

  function close() {
    setOpenId(null);
    const previous = opener.current;
    opener.current = null;
    if (previous && previous.isConnected) previous.focus();
  }

  if (services.length === 0) {
    return (
      <p className="rounded-lg border border-navy/10 bg-white px-5 py-4 text-[0.95rem] text-navy-soft shadow-[var(--shadow-soft)]">
        {copy.empty}
      </p>
    );
  }

  return (
    <>
      <ul className={cn("grid gap-5 sm:grid-cols-2", columns === 3 && "lg:grid-cols-3")}>
        {services.map((service) => {
          const price = formatEuro(service.price_cents);
          return (
            <li
              key={service.id}
              className="flex flex-col rounded-lg border border-navy/10 bg-white p-6 shadow-[var(--shadow-soft)] transition-shadow duration-300 hover:shadow-[var(--shadow-card)]"
            >
              <h3 className="font-serif text-xl leading-snug text-navy">{service.name}</h3>
              {service.tagline && <p className="mt-1.5 text-sm leading-snug text-navy-soft">{service.tagline}</p>}

              <p className="mt-5 font-serif text-4xl leading-none text-navy">{price}</p>
              {service.timeline && <p className="mt-2 text-[0.8rem] text-navy-muted">{service.timeline}</p>}

              {Array.isArray(service.includes) && service.includes.length > 0 && (
                <ul className="mt-5 space-y-2.5">
                  {service.includes.slice(0, INCLUDES_SHOWN).map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <Check className="mt-1 size-3.5 shrink-0 text-gold-dark" aria-hidden />
                      <span className="text-[0.88rem] leading-relaxed text-navy-soft">
                        <RichText text={feature} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-auto flex flex-col gap-2.5 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  aria-label={copy.detailsAria(service.name)}
                  onClick={(event) => show(service, event.currentTarget)}
                  className="w-full"
                >
                  {copy.details}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  aria-label={copy.buyAria(service.name, price)}
                  onClick={(event) => show(service, event.currentTarget)}
                  className="w-full"
                >
                  {copy.buy(price)}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {open && <PurchaseDrawer key={open.id} service={open} docLabels={docLabels[open.id] ?? []} onClose={close} />}
    </>
  );
}
