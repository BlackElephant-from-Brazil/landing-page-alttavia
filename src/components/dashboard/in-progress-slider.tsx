import Link from "next/link";
import { ArrowRight, Check, FileText, Sparkles } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { formatEuro } from "@/content/bank-nif";
import { cn } from "@/lib/cn";
import type { ClientOrderSummary } from "@/lib/db/client-queries";

import { Confetti } from "./confetti";
import { formatDate, isRecentlyCompleted, nextStep } from "./order-status";
import { PayButton } from "./pay-button";
import { Pill, PAYMENT_LABEL } from "./pills";
import { SliderControls } from "./slider-controls";

/**
 * "In progress": one card per order the client still has something to do
 * with. Orders awaiting payment sit here too, with the Awaiting payment pill
 * and a Pay button, since the dashboard home no longer carries the purchases
 * table. Then the orders paid and not complete, and the ones completed in the
 * last seven days, which keep their place with a Delivered badge and a
 * confetti burst on every page load. Which orders qualify is decided by
 * `showsInProgress` in order-status.ts; the page filters and this file lays
 * out.
 *
 * The track is a scroll-snap list, one card per view below `lg` and two
 * from `lg` up, scrolled by the arrows and dots in slider-controls.tsx or
 * by a swipe. Server component; the controls, the confetti and the Pay
 * button are the client islands.
 *
 * Every card ends on a row aligned right: See more, an outline link to
 * `?order=<id>` on the same page which the server answers by rendering the
 * order modal, and, while the order is unpaid, Pay with its amount as the
 * primary button beside it.
 */

const TRACK_ID = "in-progress-track";

const copy = {
  heading: "In progress",
  lead: "Where each order stands and what, if anything, we need from you.",
  delivered: "Delivered",
  completedOn: (date: string) => `Completed on ${date}`,
  orderedOn: (date: string) => `Ordered on ${date}`,
  stages: (done: number, total: number) => `${done} of ${total} stages`,
  documents: (received: number, required: number) => `Documents received ${received}/${required}`,
  nextLabel: "Next",
  seeMore: "See more",
  seeMoreAria: (name: string) => `See more about ${name}`,
  pay: (price: string) => `Pay ${price}`,
  purchases: "See my purchases",
} as const;

/** The outline shape See more shares with the client area's other link buttons. */
const seeMoreClass =
  "inline-flex h-11 items-center gap-2 rounded-full border border-navy/20 px-5 text-sm font-medium text-navy transition-colors duration-200 hover:border-navy hover:bg-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white";

export function InProgressSlider({
  items,
  basePath,
  purchasesHref,
  now = new Date(),
}: {
  items: readonly ClientOrderSummary[];
  /** The page's own path: See more links to `${basePath}?order=<id>`. */
  basePath: string;
  purchasesHref: string;
  now?: Date;
}) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="in-progress-heading">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 id="in-progress-heading" className="font-serif text-[clamp(1.4rem,2.6vw,1.85rem)] leading-tight text-navy">
            {copy.heading}
          </h2>
          <p className="mt-2 max-w-prose text-[0.95rem] leading-relaxed text-navy-soft">{copy.lead}</p>
        </div>
      </div>

      <ul
        id={TRACK_ID}
        aria-label={copy.heading}
        className="mt-6 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-1 [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <li key={item.order.id} className="w-full shrink-0 snap-start lg:w-[calc(50%-0.625rem)]">
            <ProgressCard item={item} basePath={basePath} now={now} />
          </li>
        ))}
      </ul>

      <SliderControls trackId={TRACK_ID} label={copy.heading} />

      <ButtonLink href={purchasesHref} variant="outline" size="md" className="mt-6">
        {copy.purchases}
        <ArrowRight className="size-4" aria-hidden />
      </ButtonLink>
    </section>
  );
}

function ProgressCard({ item, basePath, now }: { item: ClientOrderSummary; basePath: string; now: Date }) {
  const { order, service, stageLabel, progress, docs } = item;
  const completed = !!order.completed_at;
  const delivered = isRecentlyCompleted(order, now);
  const unpaid = !order.paid_at;
  const name = service.name;
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  // The pill already says "Awaiting payment", which is also the first stage's
  // label, so an unpaid card carries its date here instead of the same words twice.
  const subline = unpaid
    ? copy.orderedOn(formatDate(order.created_at))
    : completed && order.completed_at
      ? copy.completedOn(formatDate(order.completed_at))
      : stageLabel;
  const next = nextStep({
    paid: !!order.paid_at,
    completed,
    docs,
    deliverables: item.deliverables,
  });

  return (
    <article
      aria-labelledby={`progress-${order.id}`}
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-lg border bg-white p-6 shadow-[var(--shadow-soft)] sm:p-7",
        delivered ? "border-gold/60 ring-1 ring-gold/40" : "border-navy/10",
      )}
    >
      {delivered && <Confetti />}

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 id={`progress-${order.id}`} className="font-serif text-xl leading-snug text-navy">
            {name}
          </h3>
          <p className="mt-1 text-[0.9rem] text-navy-soft">{subline}</p>
        </div>
        {delivered && (
          <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-navy px-3 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-white">
            <Sparkles className="size-3.5 text-gold-light" aria-hidden />
            {copy.delivered}
          </span>
        )}
        {unpaid && (
          <Pill tone="gold" className="shrink-0">
            {PAYMENT_LABEL.awaiting}
          </Pill>
        )}
      </div>

      <div className="relative mt-5">
        <div className="flex items-baseline justify-between gap-4 text-[0.8rem] text-navy-muted">
          <span>{copy.stages(progress.done, progress.total)}</span>
          <span className="tabular-nums">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={`${name} progress`}
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          aria-valuetext={copy.stages(progress.done, progress.total)}
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-navy/5"
        >
          <div className={cn("h-full rounded-full", completed ? "bg-navy" : "bg-gold")} style={{ width: `${percent}%` }} />
        </div>
      </div>

      <dl className="relative mt-5 space-y-2 text-[0.9rem]">
        <div className="flex items-center gap-2.5 text-navy-soft">
          <FileText className="size-4 shrink-0 text-gold-dark" aria-hidden />
          <dt className="sr-only">Documents</dt>
          <dd>{copy.documents(docs.received, docs.required)}</dd>
        </div>
        <div className="flex items-start gap-2.5">
          <Check className="mt-1 size-4 shrink-0 text-gold-dark" aria-hidden />
          <dt className="shrink-0 text-navy-muted">{copy.nextLabel}:</dt>
          <dd className="font-medium text-navy">{next}</dd>
        </div>
      </dl>

      <div className="relative mt-auto flex flex-wrap items-start justify-end gap-3 pt-6">
        <Link href={`${basePath}?order=${order.id}`} scroll={false} aria-label={copy.seeMoreAria(name)} className={seeMoreClass}>
          {copy.seeMore}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        {unpaid && (
          <PayButton
            userServiceId={order.id}
            label={copy.pay(formatEuro(order.total_cents))}
            size="md"
            align="end"
            wide={false}
          />
        )}
      </div>
    </article>
  );
}
