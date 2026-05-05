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
//  1. Top center → sweep left through hero
//  2. Left side through services upper and services/WhyUs boundary
//  3. Left edge through WhyUs mid and lower — end of visible portion
const DESKTOP_WAYPOINTS: Waypoint[] = [
  [500, 0.000],   // start top center (hero)
  [380, 0.035],   // sweep left through hero
  [200, 0.075],   // left side, services upper
  [110, 0.130],   // settle left at services/WhyUs boundary
  [90,  0.185],   // left edge, WhyUs upper
  [90,  0.235],   // left side, WhyUs mid
  [110, 0.270],   // WhyUs lower — end of visible portion
];

const MOBILE_WAYPOINTS: Waypoint[] = [
  // Start top-center, sweep left and descend the left side through services and WhyUs.
  // X stays in ~120–500 range. No off-screen exits — road is always visible inside sections.
  [500, 0.000],   // top center (hero)
  [360, 0.040],   // sweep left
  [200, 0.085],   // left side services
  [140, 0.135],   // services lower
  [120, 0.185],   // WhyUs left
  [120, 0.235],   // WhyUs mid
  [140, 0.270],   // WhyUs lower
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

