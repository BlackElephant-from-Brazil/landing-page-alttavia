"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { buildPathD } from "./road-path";

type YLenSample = { y: number; len: number };

/**
 * Maps a target Y coordinate (in SVG space, i.e. page-height units) to the
 * arc length of the path that should be drawn to "reach" that Y.
 *
 * Scans the full lookup table and returns the LAST sample whose y <= targetY.
 * This naturally fast-forwards through backward loops (globe orbit, location
 * loop): when the path dips back up in Y and then re-descends, the tip
 * jumps ahead to the last point at that Y, keeping the drawn line at the
 * viewport center regardless of how the path curves.
 */
function yToArcLength(targetY: number, table: YLenSample[]): number {
  let result = 0;
  for (const sample of table) {
    if (sample.y <= targetY) result = sample.len;
  }
  return result;
}

export function RoadOverlay({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [variant, setVariant] = useState<"desktop" | "mobile">("desktop");
  const [totalHeight, setTotalHeight] = useState(0);
  const pathRef = useRef<SVGPathElement>(null);
  const pathLengthMV = useMotionValue(0);
  // Y->arcLength lookup table built once after path is measured.
  const lookupRef = useRef<YLenSample[]>([]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setVariant(mq.matches ? "desktop" : "mobile");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const measure = () => setTotalHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(el);
    window.addEventListener("load", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("load", measure);
    };
  }, []);

  useEffect(() => {
    if (!pathRef.current || !totalHeight) return;
    const path = pathRef.current;
    const totalLen = path.getTotalLength();
    pathLengthMV.set(totalLen);
    lookupRef.current = [];

    // Build the lookup table during idle time so it does not block first paint.
    // Capture path reference so it stays valid inside the deferred callback.
    const build = () => {
      const N = 1000;
      const table: YLenSample[] = [];
      for (let i = 0; i <= N; i++) {
        const len = (i / N) * totalLen;
        const pt = path.getPointAtLength(len);
        table.push({ y: pt.y, len });
      }
      lookupRef.current = table;
    };

    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(build);
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(build, 50);
    return () => clearTimeout(id);
  }, [totalHeight, variant, pathLengthMV]);

  // scrollY is the raw scroll offset; used (not scrollYProgress) so we can
  // add half a viewport height to track the viewport center, not the top edge.
  const { scrollY } = useScroll();

  const strokeDashoffset: MotionValue<number> = useTransform(
    [scrollY, pathLengthMV] as MotionValue<number>[],
    ([sy, len]: number[]) => {
      const totalLen = len as number;
      if (!totalLen || !lookupRef.current.length) return totalLen;
      const vph = window.innerHeight;
      // Y of the viewport center in SVG/page coordinates.
      const centerY = (sy as number) + vph / 2;
      const arcLen = yToArcLength(centerY, lookupRef.current);
      return totalLen - arcLen;
    }
  );

  const pathD = totalHeight ? buildPathD(variant, totalHeight) : "";

  const strokeWidth =
    variant === "desktop"
      ? "var(--road-stroke)"
      : "var(--road-stroke-mobile)";

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
        {/* Gray base -- always fully visible */}
        <path
          ref={pathRef}
          d={pathD}
          fill="none"
          stroke="#D4D4D4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth, opacity: 0.55 }}
        />

        {/* Gold fill -- tip tracks viewport center */}
        <motion.path
          d={pathD}
          fill="none"
          stroke="var(--color-gold)"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{
            strokeWidth,
            strokeDasharray: pathLengthMV,
            strokeDashoffset: prefersReducedMotion ? 0 : strokeDashoffset,
            opacity: 0.7,
            willChange: "stroke-dashoffset",
          }}
        />
      </svg>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
