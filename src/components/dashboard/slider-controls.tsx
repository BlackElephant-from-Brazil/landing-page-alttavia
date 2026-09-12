"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Previous, Next and the dots under the "In progress" track. The track is a
 * plain scroll-snap list rendered by the server (in-progress-slider.tsx);
 * this island finds it by id, measures how many cards fit in one view and
 * scrolls it one view at a time. No library, no state beyond the current
 * page, which follows the track's own scroll position, so a swipe on a
 * phone moves the dots as well.
 *
 * Nothing renders until the track has been measured on the client, and
 * nothing renders at all when every card already fits: one card on one
 * screen needs no arrows. Scrolling is smooth unless the visitor asked for
 * reduced motion.
 */

const copy = {
  previous: "Previous",
  next: "Next",
  page: (n: number, total: number) => `Go to page ${n} of ${total}`,
  pages: "Pages",
} as const;

export function SliderControls({ trackId, label }: { trackId: string; label: string }) {
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(0);

  const track = useCallback(() => document.getElementById(trackId), [trackId]);

  useEffect(() => {
    const el = track();
    if (!el) return;

    const measure = () => {
      const first = el.firstElementChild as HTMLElement | null;
      const perView = first && first.offsetWidth > 0 ? Math.max(1, Math.round(el.clientWidth / first.offsetWidth)) : 1;
      setPages(Math.ceil(el.children.length / perView));
      setPage(el.clientWidth > 0 ? Math.round(el.scrollLeft / el.clientWidth) : 0);
    };
    measure();

    const onScroll = () => {
      if (el.clientWidth > 0) setPage(Math.round(el.scrollLeft / el.clientWidth));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [track]);

  function go(target: number) {
    const el = track();
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clamped = Math.max(0, Math.min(pages - 1, target));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: reduced ? "auto" : "smooth" });
  }

  if (pages <= 1) return null;

  return (
    <div className="mt-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2" role="group" aria-label={copy.pages}>
        {Array.from({ length: pages }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={copy.page(i + 1, pages)}
            aria-current={i === page ? "true" : undefined}
            className={cn(
              "flex size-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
            )}
          >
            <span
              className={cn(
                "block rounded-full transition-all duration-300 motion-reduce:transition-none",
                i === page ? "h-2 w-5 bg-navy" : "size-2 bg-navy/25 hover:bg-navy/50",
              )}
              aria-hidden
            />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <ArrowButton onClick={() => go(page - 1)} disabled={page <= 0} label={copy.previous}>
          <ChevronLeft className="size-4" aria-hidden />
        </ArrowButton>
        <ArrowButton onClick={() => go(page + 1)} disabled={page >= pages - 1} label={copy.next}>
          <ChevronRight className="size-4" aria-hidden />
        </ArrowButton>
      </div>
      <span className="sr-only" aria-live="polite">
        {label}, page {page + 1} of {pages}
      </span>
    </div>
  );
}

function ArrowButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-full border border-navy/20 bg-white text-navy transition-colors duration-200",
        "hover:border-navy hover:bg-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        "disabled:cursor-default disabled:border-navy/10 disabled:text-navy-muted/50 disabled:hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}
