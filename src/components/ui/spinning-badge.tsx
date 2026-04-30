import { LiquidGlassShell } from "@/components/ui/LiquidGlass";

const TEXT = "CERTIFIED LAWYERS · ZERO MIDDLEMEN · ";
const FULL_TEXT = TEXT + TEXT;

export function SpinningBadge() {
  return (
    <LiquidGlassShell
      lightVariant
      tintOpacity={0.45}
      filter="glass-distortion-soft"
      borderRadius="9999px"
      className="w-[128px] h-[128px] items-center justify-center shrink-0"
    >
      <svg
        viewBox="0 0 128 128"
        width="128"
        height="128"
        className="absolute inset-0"
        aria-hidden
      >
        <defs>
          <path
            id="spinning-badge-path"
            d="M 64,64 m -48,0 a 48,48 0 1,1 96,0 a 48,48 0 1,1 -96,0"
          />
        </defs>

        {/* Rotating group: text orbits, icon counter-rotates to stay upright */}
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 64 64"
            to="360 64 64"
            dur="12s"
            repeatCount="indefinite"
          />
          <text
            fontSize="7"
            fill="var(--color-navy-muted)"
            letterSpacing="0.12em"
            fontFamily="var(--font-sans)"
            fontWeight="500"
          >
            <textPath href="#spinning-badge-path" textLength="301" lengthAdjust="spacing">
              {FULL_TEXT}
            </textPath>
          </text>
        </g>

        {/* Icon group: counter-rotates to stay upright */}
        <g transform="translate(52, 52)">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 12 12"
            to="-360 12 12"
            dur="12s"
            repeatCount="indefinite"
            additive="sum"
          />
          {/* Scale icon as inline SVG, 24x24 */}
          <svg
            x="0"
            y="0"
            width="24"
            height="24"
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
