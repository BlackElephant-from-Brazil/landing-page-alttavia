import { LiquidGlassShell } from "@alttavia/liquid-glass";

const FULL_TEXT = "CERTIFIED LAWYERS · CERTIFIED LAWYERS · ";

export function SpinningBadge() {
  return (
    <LiquidGlassShell
      lightVariant
      tintOpacity={0.45}
      filter="glass-distortion-soft"
      borderRadius="9999px"
      className="w-[250px] h-[250px] items-center justify-center shrink-0"
    >
      <svg
        viewBox="0 0 250 250"
        width="250"
        height="250"
        className="absolute inset-0"
        aria-hidden
      >
        <defs>
          <path
            id="spinning-badge-path"
            d="M 125,125 m -100,0 a 100,100 0 1,1 200,0 a 100,100 0 1,1 -200,0"
          />
        </defs>

        {/* Text rotates along the circle path */}
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 125 125"
            to="360 125 125"
            dur="14s"
            repeatCount="indefinite"
          />
          <text
            fontSize="11"
            fill="var(--color-navy-muted)"
            letterSpacing="0.10em"
            fontFamily="var(--font-sans)"
            fontWeight="500"
          >
            <textPath href="#spinning-badge-path" textLength="628" lengthAdjust="spacing">
              {FULL_TEXT}
            </textPath>
          </text>
        </g>

        {/* Icon stays fixed at center — no animation */}
        <g transform="translate(101, 101)">
          <svg
            x="0"
            y="0"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-navy)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path d="M7 21h10" />
            <path d="M12 3v18" />
            <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
          </svg>
        </g>
      </svg>
    </LiquidGlassShell>
  );
}
