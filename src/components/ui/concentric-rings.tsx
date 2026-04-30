import { cn } from "@/lib/cn";

type ConcentricRingsProps = {
  /** Number of rings (1–5). Default 3. */
  count?: 1 | 2 | 3 | 4 | 5;
  /** Outer-most ring radius in px. Default 24. */
  size?: number;
  /** Hairline stroke width in px. Default 0.75. */
  strokeWidth?: number;
  /** Stroke color (CSS color). Default "rgba(208,161,43,0.30)". Inner rings step down opacity. */
  color?: string;
  className?: string;
};

/**
 * Atelier micromark: a stack of concentric hairline rings.
 * Used as a corner ornament on cards, near logos, and around the globe.
 */
export function ConcentricRings({
  count = 3,
  size = 24,
  strokeWidth = 0.75,
  color = "rgba(208,161,43,0.30)",
  className,
}: ConcentricRingsProps) {
  const cx = size + strokeWidth;
  const cy = size + strokeWidth;
  const viewBoxSize = (size + strokeWidth) * 2;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width={viewBoxSize}
      height={viewBoxSize}
      className={cn("pointer-events-none", className)}
    >
      {Array.from({ length: count }).map((_, i) => {
        // Inner rings get smaller and slightly more opaque
        const r = size * (1 - i * 0.22);
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            opacity={1 - i * 0.18}
          />
        );
      })}
    </svg>
  );
}
