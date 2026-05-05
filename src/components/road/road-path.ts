/**
 * Master path data for the animated road overlay.
 *
 * The road is rendered into a viewBox sized to the wrapper element's
 * scrollHeight. Coordinates here are *normalized to a 1000-unit-wide grid*;
 * the SVG's preserveAspectRatio handles the actual mapping. Y-coordinates
 * scale with the wrapper's measured pixel height.
 */

export type RoadVariant = "desktop" | "mobile";

export type RoadMarkerSpec = {
  x: number;
  yRatio: number;
  onNavy: boolean;
};

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
  // Start top-center, gentle S-curves down the page.
  // X stays in ~150–850 range (well inside 375-430px viewport after scaling).
  // No globe orbit, no off-screen exits — road is always visible inside sections.
  [500, 0.000],   // top center (hero)
  [640, 0.040],
  [720, 0.085],   // sweep right in services upper
  [680, 0.130],
  [540, 0.175],   // center crossing (hero/services boundary)
  [380, 0.210],
  [250, 0.250],   // sweep left into WhyUs
  [300, 0.295],
  [480, 0.340],   // center cross (WhyUs mid)
  [660, 0.380],
  [740, 0.425],   // swing right (About upper)
  [680, 0.465],
  [500, 0.505],   // center (About mid)
  [320, 0.545],
  [220, 0.585],   // left arc (Principles)
  [300, 0.625],
  [480, 0.660],   // center cross (FAQ entry)
  [640, 0.695],
  [700, 0.735],   // right arc (FAQ lower)
  [600, 0.770],
  [460, 0.810],   // center approach (Contact)
  [340, 0.845],
  [380, 0.880],   // slight right (Location)
  [480, 0.920],
  [500, 1.000],   // exits bottom (footer)
];

/**
 * Build the SVG path `d` string from waypoints using Catmull-Rom → cubic
 * Bézier conversion. Single continuous sub-path so stroke-dashoffset
 * works globally; off-screen segments are invisible via section clip-paths.
 */
export function buildPathD(variant: RoadVariant, totalHeight: number): string {
  const waypoints = variant === "desktop" ? DESKTOP_WAYPOINTS : MOBILE_WAYPOINTS;
  const scaleY = (yr: number) => yr * totalHeight;

  const pts: [number, number][] = waypoints.map(([x, yr]) => [x, scaleY(yr)]);
  if (!pts.length) return "";

  const cmds: string[] = [`M ${pts[0][0]} ${pts[0][1]}`];

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    cmds.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`);
  }

  return cmds.join(" ");
}

