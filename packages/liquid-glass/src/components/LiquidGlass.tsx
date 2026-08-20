"use client";

import { type ReactNode } from "react";
import type { SpecularOptions } from "../gl/generate-map";

export type LiquidGlassProps = {
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  bezelWidth?: number;
  power?: number;
  strength?: number;
  specular?: SpecularOptions;
  blur?: number;
  lightVariant?: boolean;
  tintOpacity?: number;
  borderRadius?: string;
  style?: React.CSSProperties;
  debug?: boolean;
  /** @deprecated */
  filter?: string;
  /** @deprecated */
  enableHover?: boolean;
};

/**
 * Simple glass overlay: backdrop-filter blur + tint.
 * WebGL displacement path temporarily disabled for performance testing.
 */
export function LiquidGlass({
  children,
  className = "",
  contentClassName = "",
  blur = 20,
  lightVariant = false,
  tintOpacity = 0.55,
  borderRadius = "24px",
  style,
}: LiquidGlassProps) {
  const tintColor = lightVariant
    ? `rgba(255,255,255,${tintOpacity})`
    : `rgba(18,18,18,${tintOpacity})`;

  const borderColor = lightVariant
    ? "rgba(255,255,255,0.50)"
    : "rgba(255,255,255,0.12)";

  const shineGradient = lightVariant
    ? "linear-gradient(180deg,rgba(255,255,255,0.18) 0%,rgba(255,255,255,0.06) 40%,rgba(255,255,255,0.10) 100%)"
    : "linear-gradient(180deg,rgba(255,255,255,0.08) 0%,rgba(255,255,255,0.02) 40%,rgba(255,255,255,0.04) 100%)";

  const outerShadow = lightVariant
    ? "0 4px 24px rgba(0,0,0,0.06),0 0 0 1px rgba(208,161,43,0.08)"
    : "0 4px 24px rgba(0,0,0,0.1),0 0 1px rgba(255,255,255,0.1)";

  const backdropValue = `blur(${blur}px) saturate(140%)`;

  return (
    <div
      className={`relative flex ${className}`}
      style={{ borderRadius, boxShadow: outerShadow, ...style }}
    >
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ borderRadius: "inherit" }}
      >
        <div
          className="absolute inset-0 z-0"
          style={{
            backdropFilter: backdropValue,
            WebkitBackdropFilter: backdropValue,
            transform: "translateZ(0)",
          }}
        />
        <div
          className="absolute inset-0 z-[1]"
          style={{ background: tintColor }}
        />
        <div
          className="absolute inset-0 z-[2]"
          style={{
            background: shineGradient,
            boxShadow:
              "inset 1px 1px 0 0 rgba(255,255,255,0.12),inset -1px -1px 0 0 rgba(255,255,255,0.06)",
          }}
        />
      </div>

      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{ borderRadius: "inherit", border: `1px solid ${borderColor}` }}
      />

      <div
        className={`relative z-[3] w-full ${lightVariant ? "" : "text-white"} ${contentClassName}`}
        style={lightVariant ? undefined : { textShadow: "0 1px 2px rgba(0,0,0,0.14)" }}
      >
        {children}
      </div>
    </div>
  );
}

export { LiquidGlass as LiquidGlassShell };

export function LiquidGlassDefs() {
  return null;
}
