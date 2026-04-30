"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  buildPathD,
  DESKTOP_MARKERS,
  MOBILE_MARKERS,
  SECTION_IDS,
  NAVY_SECTIONS,
  type SectionId,
} from "./road-path";
import { RoadMarker } from "./road-marker";

type RoadOverlayProps = {
  children: React.ReactNode;
};

type SectionRect = { id: SectionId; top: number; height: number };

/**
 * Wraps the page content (everything below the navbar). Renders an absolutely
 * positioned SVG covering the full wrapper height. The road path is drawn by
 * scroll progress (stroke-dashoffset) and clipped per-section so the stroke
 * color shifts at light↔navy boundaries.
 *
 * Performance:
 *  - opacity 0.6 on the whole road group
 *  - pointer-events: none
 *  - z-index: 0; child sections must establish their own stacking context
 *    (e.g., `relative z-10`) so content stays above the road.
 */
export function RoadOverlay({ children }: RoadOverlayProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [variant, setVariant] = useState<"desktop" | "mobile">("desktop");
  const [totalHeight, setTotalHeight] = useState(0);
  const [sectionRects, setSectionRects] = useState<SectionRect[]>([]);
  const [pathLength, setPathLength] = useState(1);
  const pathRef = useRef<SVGPathElement>(null);

  // Detect variant
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setVariant(mq.matches ? "desktop" : "mobile");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Measure wrapper height + section positions
  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;

    const measure = () => {
      const wrapperTop = el.getBoundingClientRect().top + window.scrollY;
      setTotalHeight(el.scrollHeight);

      const rects: SectionRect[] = [];
      for (const id of SECTION_IDS) {
        // Hero is "#top"; everything else uses its anchor id;
        // footer is the only one that uses tag-based selection.
        let secEl: HTMLElement | null = null;
        if (id === "hero") {
          secEl = document.getElementById("top");
        } else if (id === "footer") {
          secEl = el.querySelector("footer");
        } else if (id === "ctaBanner") {
          // CtaBanner has no id; pick the section between #faq and #contact.
          // Fall back to scanning for an element with class containing "cta" sentinel.
          const sentinel = el.querySelector("[data-section='cta-banner']");
          secEl = sentinel as HTMLElement | null;
        } else {
          secEl = document.getElementById(id);
        }
        if (!secEl) continue;
        const rect = secEl.getBoundingClientRect();
        rects.push({
          id,
          top: rect.top + window.scrollY - wrapperTop,
          height: rect.height,
        });
      }
      setSectionRects(rects);
    };

    measure();
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(el);
    window.addEventListener("load", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("load", measure);
    };
  }, []);

  // Measure path length once it renders
  useEffect(() => {
    if (!pathRef.current) return;
    setPathLength(pathRef.current.getTotalLength());
  }, [totalHeight, variant]);

  // Scroll-driven dashoffset.
  // offset: progress 0 when the wrapper's top hits the viewport top (page load,
  // since navbar is fixed and the wrapper starts at scrollY ≈ 0),
  // progress 1 when the wrapper's bottom hits the viewport bottom (scrolled to
  // the very bottom of the page).
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end end"],
  });
  const strokeDashoffset = useTransform(
    scrollYProgress,
    [0, 1],
    [pathLength, 0],
  );

  const pathD = totalHeight ? buildPathD(variant, totalHeight) : "";
  const markers = variant === "desktop" ? DESKTOP_MARKERS : MOBILE_MARKERS;

  return (
    <div ref={wrapperRef} className="relative">
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        width="100%"
        height={totalHeight || "100%"}
        viewBox={`0 0 1000 ${totalHeight || 1}`}
        preserveAspectRatio="none"
        style={{ overflow: "visible" }}
      >
        <defs>
          {sectionRects.map((s) => (
            <clipPath key={s.id} id={`road-clip-${s.id}`} clipPathUnits="userSpaceOnUse">
              <rect x="-200" y={s.top} width="1400" height={s.height} />
            </clipPath>
          ))}
        </defs>
        <g style={{ opacity: "var(--road-opacity)", willChange: "transform" }}>
          {/* Master invisible path used as a length reference */}
          <path
            ref={pathRef}
            d={pathD}
            fill="none"
            stroke="transparent"
            strokeWidth="0"
          />
          {/* Per-section colored copies, animated via dashoffset */}
          {sectionRects.map((s) => (
            <motion.path
              key={s.id}
              d={pathD}
              fill="none"
              stroke={
                NAVY_SECTIONS.has(s.id)
                  ? "var(--road-color-dark)"
                  : "var(--road-color-light)"
              }
              strokeLinecap="round"
              clipPath={`url(#road-clip-${s.id})`}
              vectorEffect="non-scaling-stroke"
              style={{
                strokeWidth:
                  variant === "desktop"
                    ? "var(--road-stroke)"
                    : "var(--road-stroke-mobile)",
                strokeDasharray: pathLength,
                strokeDashoffset: prefersReducedMotion ? 0 : strokeDashoffset,
                willChange: "stroke-dashoffset",
              }}
            />
          ))}
          {/* Markers */}
          {markers.map((m) => (
            <RoadMarker key={m.id} marker={m} totalHeight={totalHeight} />
          ))}
        </g>
      </svg>

      {/* Children render above the SVG via stacking context. Each section
          should already have `relative` positioning. */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
