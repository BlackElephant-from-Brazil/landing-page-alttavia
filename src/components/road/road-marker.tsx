"use client";

import { motion } from "framer-motion";
import type { RoadMarkerSpec } from "./road-path";

type RoadMarkerProps = {
  marker: RoadMarkerSpec;
  totalHeight: number;
};

/**
 * A single gold dot along the road. Pulses on viewport entry, then loops
 * a subtle pulse animation indefinitely.
 */
export function RoadMarker({ marker, totalHeight }: RoadMarkerProps) {
  const cy = marker.yRatio * totalHeight;
  const fill = marker.onNavy ? "#E6B94A" : "#D0A12B";

  return (
    <motion.circle
      cx={marker.x}
      cy={cy}
      r={4.5}
      fill={fill}
      initial={{ scale: 0, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, margin: "-10% 0%" }}
      transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
      style={{
        transformOrigin: `${marker.x}px ${cy}px`,
        transformBox: "fill-box",
        animation: "pulse-soft var(--pulse-duration) var(--ease-smooth) infinite",
      }}
    />
  );
}
