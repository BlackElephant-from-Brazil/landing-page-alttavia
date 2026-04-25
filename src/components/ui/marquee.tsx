import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type MarqueeProps = {
  items: readonly string[];
  separator?: ReactNode;
  duration?: number;
  reverse?: boolean;
  className?: string;
  itemClassName?: string;
  edgeFade?: boolean;
};

/**
 * Infinite horizontal scroll. Renders the items twice and animates a -50%
 * translate so the loop is seamless. Pause-on-hover is set in globals.css.
 */
export function Marquee({
  items,
  separator,
  duration = 35,
  reverse = false,
  className,
  itemClassName,
  edgeFade = true,
}: MarqueeProps) {
  const sep = separator ?? <Diamond />;
  const animationClass = reverse ? "animate-marquee-reverse" : "animate-marquee";

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        edgeFade && "[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]",
        className
      )}
    >
      <div
        className={cn("flex w-max items-center gap-10 whitespace-nowrap", animationClass)}
        style={{ ["--marquee-duration" as string]: `${duration}s` }}
      >
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            aria-hidden={copy === 1}
            className="flex shrink-0 items-center gap-10"
          >
            {items.map((item, i) => (
              <li
                key={`${copy}-${i}`}
                className={cn("flex items-center gap-10", itemClassName)}
              >
                <span>{item}</span>
                {sep}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

function Diamond() {
  return (
    <span aria-hidden className="inline-block h-1.5 w-1.5 rotate-45 bg-current opacity-50" />
  );
}
