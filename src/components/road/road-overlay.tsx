"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  buildPathD,
  SECTION_IDS,
  NAVY_SECTIONS,
  type SectionId,
} from "./road-path";

type RoadOverlayProps = { children: React.ReactNode };
type SectionRect = { id: SectionId; top: number; height: number };
type PathSample = { l: number; y: number };

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function RoadOverlay({ children }: RoadOverlayProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const fillElemsRef = useRef<(SVGPathElement | null)[]>([]);

  const prefersReducedMotion = useReducedMotion();
  const [variant, setVariant] = useState<"desktop" | "mobile">("desktop");
  const [totalHeight, setTotalHeight] = useState(0);
  const [sectionRects, setSectionRects] = useState<SectionRect[]>([]);
  const [pathLength, setPathLength] = useState(0);

  const samplesRef = useRef<PathSample[]>([]);
  const pathLengthRef = useRef(0);
  const displayFillLRef = useRef(0);
  const loopAnimRef = useRef<{
    startL: number;
    endL: number;
    startTime: number;
    duration: number;
  } | null>(null);

  // Detect variant
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setVariant(mq.matches ? "desktop" : "mobile");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Measure wrapper + section rects
  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const measure = () => {
      setTotalHeight(el.scrollHeight);
      const wrapperTop = el.getBoundingClientRect().top + window.scrollY;
      const rects: SectionRect[] = [];
      for (const id of SECTION_IDS) {
        let secEl: HTMLElement | null = null;
        if (id === "hero") secEl = document.getElementById("top");
        else if (id === "footer") secEl = el.querySelector("footer");
        else if (id === "ctaBanner")
          secEl = el.querySelector("[data-section='cta-banner']") as HTMLElement | null;
        else secEl = document.getElementById(id);
        if (!secEl) continue;
        const rect = secEl.getBoundingClientRect();
        // Skip elements that are hidden (display:none returns height 0)
        if (rect.height === 0) continue;
        rects.push({ id, top: rect.top + window.scrollY - wrapperTop, height: rect.height });
      }
      setSectionRects(rects);
    };
    measure();
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(el);
    window.addEventListener("load", measure);
    return () => { ro.disconnect(); window.removeEventListener("load", measure); };
  }, []);

  // Measure path length + build Y → arc-length samples
  useEffect(() => {
    const path = pathRef.current;
    if (!path || !pathD) return;
    const len = path.getTotalLength();
    if (!len) return;
    pathLengthRef.current = len;
    setPathLength(len);
    const pts: PathSample[] = [];
    for (let i = 0; i <= 1000; i++) {
      const l = (i / 1000) * len;
      pts.push({ l, y: path.getPointAtLength(l).y });
    }
    samplesRef.current = pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalHeight, variant]);

  // Scroll-driven fill animation
  useEffect(() => {
    const applyFill = (fillL: number) => {
      const len = pathLengthRef.current;
      if (!len) return;
      const value = String(Math.max(0, len - fillL));
      for (const el of fillElemsRef.current) {
        if (el) el.style.strokeDashoffset = value;
      }
    };

    if (prefersReducedMotion) {
      applyFill(pathLengthRef.current);
      return;
    }

    let rafId: number | null = null;

    const getTarget = (): number => {
      const samples = samplesRef.current;
      if (!samples.length) return 0;
      const centerY = window.scrollY + window.innerHeight * 0.5;
      let fillL = 0;
      for (const s of samples) {
        if (s.y <= centerY) fillL = s.l;
      }
      return fillL;
    };

    const tick = (now: number) => {
      rafId = null;
      const len = pathLengthRef.current;
      if (!len) return;

      const target = getTarget();
      const current = displayFillLRef.current;
      const delta = target - current;

      const LOOP_THRESHOLD = len * 0.05;

      if (loopAnimRef.current && target < current - 10) {
        loopAnimRef.current = null;
      }

      if (!loopAnimRef.current && delta > LOOP_THRESHOLD) {
        loopAnimRef.current = {
          startL: current,
          endL: target,
          startTime: now,
          duration: 500,
        };
      }

      let fillL: number;

      if (loopAnimRef.current) {
        const anim = loopAnimRef.current;
        if (target > anim.endL) anim.endL = target;
        const elapsed = now - anim.startTime;
        const progress = Math.min(1, elapsed / anim.duration);
        fillL = anim.startL + (anim.endL - anim.startL) * easeInOut(progress);
        displayFillLRef.current = fillL;
        if (progress < 1) {
          rafId = requestAnimationFrame(tick);
        } else {
          loopAnimRef.current = null;
          displayFillLRef.current = anim.endL;
          fillL = anim.endL;
        }
      } else {
        displayFillLRef.current = target;
        fillL = target;
      }

      applyFill(fillL);
    };

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
      loopAnimRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathLength, prefersReducedMotion]);

  const pathD = totalHeight ? buildPathD(variant, totalHeight) : "";
  const strokeWidth =
    variant === "desktop" ? "var(--road-stroke)" : "var(--road-stroke-mobile)";

  return (
    <div ref={wrapperRef} className="relative">
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] hidden sm:block"
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

        <g style={{ opacity: "var(--road-opacity)" }}>
          {/* Reference path for measurement only */}
          <path ref={pathRef} d={pathD} fill="none" stroke="transparent" strokeWidth="0" />

          {/* Layer 1 — static background (section-coloured) */}
          {sectionRects.map((s) => (
            <path
              key={`bg-${s.id}`}
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
              style={{ strokeWidth }}
            />
          ))}

          {/* Layer 2 — animated gold fill (NO vectorEffect so dasharray works in user-space) */}
          {pathLength > 0 &&
            sectionRects.map((s, i) => (
              <path
                key={`fill-${s.id}`}
                ref={(el) => {
                  fillElemsRef.current[i] = el;
                  if (el) el.style.strokeDashoffset = String(pathLengthRef.current);
                }}
                d={pathD}
                fill="none"
                stroke="var(--road-color-hero)"
                strokeLinecap="round"
                clipPath={`url(#road-clip-${s.id})`}
                style={{
                  strokeWidth,
                  strokeDasharray: pathLength,
                  willChange: "stroke-dashoffset",
                }}
              />
            ))}
        </g>
      </svg>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
