"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type MarqueeProps = {
  children: ReactNode;
  /** CSS duration string. Defaults to var(--marquee-duration). */
  duration?: string;
  /** Whether to pause on hover (only on hover-capable devices). */
  pauseOnHover?: boolean;
  className?: string;
};

/**
 * Infinite horizontal marquee. Renders children twice; the duplicate is
 * aria-hidden so screen readers don't double-read. Animation halts under
 * prefers-reduced-motion via the global rule in globals.css.
 */
export function Marquee({
  children,
  duration,
  pauseOnHover = true,
  className,
}: MarqueeProps) {
  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-max items-center will-change-transform",
          pauseOnHover && "[@media(hover:hover)]:group-hover:[animation-play-state:paused]",
        )}
        style={{
          animation: `marquee ${duration ?? "var(--marquee-duration)"} linear infinite`,
        }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div aria-hidden className="flex shrink-0 items-center">{children}</div>
      </div>
    </div>
  );
}
