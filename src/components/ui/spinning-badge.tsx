const FULL_TEXT = "LAWYERS · LAWYERS · LAWYERS · LAWYERS · ";

export function SpinningBadge() {
  return (
    <div className="relative w-[270px] h-[270px] shrink-0">
      <svg
        viewBox="0 0 270 270"
        width="270"
        height="270"
        style={{ position: "absolute", top: 0, left: 0, display: "block" }}
        aria-hidden
      >
        <defs>
          <path
            id="spinning-badge-path"
            d="M 135,135 m -108,0 a 108,108 0 1,1 216,0 a 108,108 0 1,1 -216,0"
          />
        </defs>

        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 135 135"
            to="360 135 135"
            dur="14s"
            repeatCount="indefinite"
          />
          <text
            fontSize="16"
            fill="var(--color-navy-muted)"
            letterSpacing="0.10em"
            fontFamily="var(--font-sans)"
            fontWeight="500"
          >
            <textPath href="#spinning-badge-path" textLength="679" lengthAdjust="spacing">
              {FULL_TEXT}
            </textPath>
          </text>
        </g>

        {/* Icon at center — fixed, not rotating */}
        <g transform="translate(97, 97)">
          <svg
            x="0"
            y="0"
            width="77"
            height="77"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-navy)"
            strokeWidth="1.2"
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
    </div>
  );
}
