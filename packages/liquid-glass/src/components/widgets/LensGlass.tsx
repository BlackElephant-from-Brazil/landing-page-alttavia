"use client";

import { type ReactNode } from "react";
import { LiquidGlass } from "../LiquidGlass";

export type LensGlassProps = {
  /** Diameter in px (component is always square). */
  size?: number;
  children?: ReactNode;
  className?: string;
};

/**
 * Circular magnifying-glass lens.
 * Uses power=2 (Euclidean circle SDF) and strong displacement for maximum lens effect.
 */
export function LensGlass({ size = 200, children, className = "" }: LensGlassProps) {
  const bezelWidth = Math.round(size * 0.1);
  return (
    <LiquidGlass
      bezelWidth={bezelWidth}
      power={2}
      strength={1.5}
      specular={{ opacity: 0.6, saturation: 1.2, angle: -1.05 }}
      borderRadius="9999px"
      lightVariant
      tintOpacity={0.08}
      className={`items-center justify-center shrink-0 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {children}
    </LiquidGlass>
  );
}
