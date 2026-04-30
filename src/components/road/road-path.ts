/**
 * Master path data for the animated road overlay.
 *
 * The road is rendered into a viewBox sized to the wrapper element's
 * scrollHeight. Coordinates here are *normalized to a 1000-unit-wide grid*;
 * the SVG's preserveAspectRatio handles the actual mapping. Y-coordinates
 * scale with the wrapper's measured pixel height.
 */

export type RoadVariant = "desktop" | "mobile";

/**
 * The visible portions of the path, expressed as ratios of the wrapper height.
 * Section ratios are computed at runtime from the actual rendered DOM positions
 * (RoadOverlay measures section refs); these constants are only the curve-shape
 * waypoints that control personality.
 */
export type SectionId =
  | "hero"
  | "services"
  | "why"
  | "about"
  | "principles"
  | "faq"
  | "ctaBanner"
  | "contact"
  | "location"
  | "footer";

export const SECTION_IDS: readonly SectionId[] = [
  "hero",
  "services",
  "why",
  "about",
  "principles",
  "faq",
  "ctaBanner",
  "contact",
  "location",
  "footer",
] as const;

/**
 * Sections rendered in navy. Used for per-section path coloring.
 * Keep in sync with the spec section 4.
 */
export const NAVY_SECTIONS: ReadonlySet<SectionId> = new Set([
  "why",
  "principles",
  "footer",
]);

/**
 * Master path for desktop. ViewBox is 1000 wide × dynamic height.
 * Multiple `M` commands produce the screen-edge "exit and re-enter" effect
 * (off-viewBox segments are simply not visible).
 *
 * Coordinates assume a viewBox of `0 0 1000 H` where H is the wrapper height.
 * Y-coordinates here are *placeholder ratios scaled to a reference 7000-tall page*;
 * the path generator below scales Y to the actual measured height.
 */
const REFERENCE_HEIGHT = 7000;

// Waypoints expressed as [x, y-ratio]. y-ratio is y / REFERENCE_HEIGHT
// so the path scales gracefully across page heights.
type Waypoint = [number, number]; // [x in 0–1000, yRatio in 0–1+]

// Personality waypoints (see spec §5.2):
//  1. Top center → sweep right through services
//  2. Globe orbit (~270° anti-clockwise) in WhyUs around (right ~75%, mid)
//  3. Sweep left → exit screen left in About
//  4. Re-enter left → sweep right → exit right in Principles bottom
//  5. CTA detour
//  6. Location loop → straight descent into footer
const DESKTOP_WAYPOINTS: Waypoint[] = [
  [500, 0.000],   // start top center
  [720, 0.040],
  [890, 0.080],   // services right side
  [950, 0.130],   // entering WhyUs upper right
  [820, 0.160],   // start orbit, descending into globe area
  [710, 0.200],
  [780, 0.230],   // orbit bottom-back
  [900, 0.225],   // orbit right
  [990, 0.190],   // orbit top-right
  [890, 0.150],   // closing orbit
  [780, 0.180],
  [600, 0.220],
  [350, 0.250],   // sweep left across About top
  [80, 0.270],
  [-80, 0.300],   // EXIT LEFT EDGE
  [-80, 0.330],   // re-enter left (off-viewBox above means invisible bridge)
  [120, 0.345],
  [400, 0.360],
  [700, 0.380],
  [950, 0.400],
  [1080, 0.420],  // EXIT RIGHT EDGE (Principles bottom)
  [1080, 0.450],  // re-enter right
  [880, 0.470],
  [600, 0.500],
  [350, 0.540],   // FAQ left-ish
  [200, 0.580],
  [120, 0.620],   // CTA detour: comes around card from left
  [180, 0.660],   // under the card horizontally
  [400, 0.665],
  [620, 0.660],
  [780, 0.690],
  [800, 0.730],   // descending into Contact
  [620, 0.760],
  [430, 0.790],   // Location
  [380, 0.820],
  [450, 0.850],   // small loop in Location
  [560, 0.870],
  [560, 0.900],
  [500, 0.940],
  [500, 1.000],   // exits bottom (footer)
];

const MOBILE_WAYPOINTS: Waypoint[] = [
  [500, 0.000],
  [620, 0.060],
  [720, 0.110],
  [780, 0.180],   // single curve near globe (no full orbit)
  [620, 0.230],
  [400, 0.270],
  [220, 0.310],
  [320, 0.380],
  [500, 0.430],
  [680, 0.490],
  [620, 0.560],
  [400, 0.620],
  [300, 0.690],
  [400, 0.750],
  [520, 0.810],
  [500, 0.880],
  [500, 1.000],
];

/**
 * Build the SVG path `d` string from waypoints, using cubic Béziers between
 * each pair (control points placed at one-third along the segment for smooth
 * curvature). The `M` command splits at jumps where x leaves the visible
 * viewBox to create the edge-exit/re-enter illusion.
 */
export function buildPathD(variant: RoadVariant, totalHeight: number): string {
  const waypoints = variant === "desktop" ? DESKTOP_WAYPOINTS : MOBILE_WAYPOINTS;
  const scaleY = (yr: number) => yr * totalHeight;

  const cmds: string[] = [];
  let prevOffViewbox = false;

  for (let i = 0; i < waypoints.length; i++) {
    const [x, yr] = waypoints[i];
    const y = scaleY(yr);
    const offViewbox = x < -50 || x > 1050;

    if (i === 0) {
      cmds.push(`M ${x} ${y}`);
    } else if (prevOffViewbox && !offViewbox) {
      // Just re-entered visible area: lift pen with M
      cmds.push(`M ${x} ${y}`);
    } else {
      const [px, pyr] = waypoints[i - 1];
      const py = scaleY(pyr);
      const c1x = px + (x - px) / 3;
      const c1y = py + (y - py) / 3;
      const c2x = px + ((x - px) * 2) / 3;
      const c2y = py + ((y - py) * 2) / 3;
      // Add a slight tangent perturbation so the curve has personality
      const dx = (i % 2 === 0) ? 30 : -30;
      cmds.push(`C ${c1x + dx} ${c1y}, ${c2x - dx} ${c2y}, ${x} ${y}`);
    }

    prevOffViewbox = offViewbox;
  }

  return cmds.join(" ");
}

/**
 * Marker waypoint info for the gold dots placed along the path.
 * Each marker has a label (used for aria) and a y-ratio + x position.
 */
export type RoadMarkerSpec = {
  id: string;
  x: number;
  yRatio: number;
  /** If true, marker uses the lighter gold (over navy). */
  onNavy?: boolean;
};

export const DESKTOP_MARKERS: readonly RoadMarkerSpec[] = [
  { id: "services-edge", x: 950, yRatio: 0.130 },
  { id: "globe-orbit", x: 820, yRatio: 0.160, onNavy: true },
  { id: "left-exit", x: 80, yRatio: 0.270 },
  { id: "right-exit", x: 950, yRatio: 0.400, onNavy: true },
  { id: "cta-detour", x: 120, yRatio: 0.620 },
  { id: "footer-arrival", x: 500, yRatio: 0.940 },
] as const;

export const MOBILE_MARKERS: readonly RoadMarkerSpec[] = [
  { id: "globe-pass", x: 780, yRatio: 0.180, onNavy: true },
  { id: "left-curve", x: 220, yRatio: 0.310 },
  { id: "mid-arc", x: 680, yRatio: 0.490 },
  { id: "footer-arrival", x: 500, yRatio: 0.880 },
] as const;
