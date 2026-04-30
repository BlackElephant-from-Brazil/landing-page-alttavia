"use client";

import { type ReactNode, useId, useRef } from "react";
import type { SpecularOptions } from "../gl/generate-map";
import { useResizeObserver } from "../hooks/useResizeObserver";
import { useFeatureDetect } from "../hooks/useFeatureDetect";
import { useDisplacementMap } from "../hooks/useDisplacementMap";

export type LiquidGlassProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Bezel width in pixels. The ring around the edge that gets refracted. */
  bezelWidth?: number;
  /** Squircle exponent -- 6 = Apple default. Higher = more rectangular corners. */
  power?: number;
  /** Displacement strength multiplier. */
  strength?: number;
  specular?: SpecularOptions;
  /** Additional backdrop blur in px (stacked on the filter). */
  blur?: number;
  /** White tint (light surfaces) vs dark tint. */
  lightVariant?: boolean;
  tintOpacity?: number;
  borderRadius?: string;
  style?: React.CSSProperties;
  /** @deprecated use bezelWidth/power/strength instead */
  filter?: string;
  /** @deprecated ignored -- kept for drop-in compatibility with LiquidGlassShell */
  enableHover?: boolean;
};

/**
 * Liquid glass overlay component.
 *
 * In Chromium: renders a WebGL-generated displacement map via SVG feDisplacementMap
 * as backdrop-filter -- physically correct refraction of DOM content behind the element.
 *
 * In Safari / Firefox: falls back to backdrop-filter: blur() + tint.
 */
export function LiquidGlass({
  children,
  className = "",
  contentClassName = "",
  bezelWidth = 20,
  power = 6,
  strength = 1,
  specular = { opacity: 0.4, saturation: 1, angle: -Math.PI / 3 },
  blur = 20,
  lightVariant = false,
  tintOpacity = 0.55,
  borderRadius = "24px",
  style,
}: LiquidGlassProps) {
  const rawId = useId();
  // useId returns ":r0:" etc -- strip colons for valid SVG id
  const filterId = `lg-${rawId.replace(/:/g, "")}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useResizeObserver(containerRef);
  const { backdropFilterUrl, backdropFilter } = useFeatureDetect();
  const maps = useDisplacementMap(width, height, { bezelWidth, power, strength, specular });

  // -- Visual tokens --
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

  // -- Backdrop filter value --
  // Chromium: SVG displacement filter + optional extra blur
  // Others  : blur + saturate
  const hasFilter = backdropFilterUrl && maps !== null;
  const backdropValue = hasFilter
    ? `url(#${filterId})${blur > 0 ? ` blur(${blur}px)` : ""}`
    : backdropFilter
    ? `blur(${blur}px) saturate(140%)`
    : "none";

  return (
    <div
      ref={containerRef}
      className={`relative flex ${className}`}
      style={{ borderRadius, boxShadow: outerShadow, ...style }}
    >
      {/* SVG filter -- inline, one per component instance */}
      {hasFilter && maps && (
        <svg
          style={{ display: "none", position: "absolute" }}
          aria-hidden
          focusable="false"
        >
          <defs>
            <filter
              id={filterId}
              x="0%" y="0%" width="100%" height="100%"
              colorInterpolationFilters="sRGB"
              filterUnits="objectBoundingBox"
            >
              {/* Displacement map pass */}
              <feImage
                href={maps.displacementUrl}
                result="dispMap"
                preserveAspectRatio="none"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="dispMap"
                scale={maps.maxDisplacement}
                xChannelSelector="R"
                yChannelSelector="G"
                result="refracted"
              />
              {/* Specular highlight blended on top */}
              <feImage
                href={maps.specularUrl}
                result="specular"
                preserveAspectRatio="none"
              />
              <feBlend
                in="refracted"
                in2="specular"
                mode="screen"
              />
            </filter>
          </defs>
        </svg>
      )}

      {/* Backdrop layers */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ borderRadius: "inherit" }}
      >
        {/* Blur / refraction layer */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backdropFilter: backdropValue,
            WebkitBackdropFilter: backdropValue,
          }}
        />
        {/* Tint */}
        <div
          className="absolute inset-0 z-[1]"
          style={{ background: tintColor }}
        />
        {/* Shine gradient + inner border highlight */}
        <div
          className="absolute inset-0 z-[2]"
          style={{
            background: shineGradient,
            boxShadow:
              "inset 1px 1px 0 0 rgba(255,255,255,0.12),inset -1px -1px 0 0 rgba(255,255,255,0.06)",
          }}
        />
      </div>

      {/* Outer border */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{ borderRadius: "inherit", border: `1px solid ${borderColor}` }}
      />

      {/* Content */}
      <div
        className={`relative z-[3] w-full ${lightVariant ? "" : "text-white"} ${contentClassName}`}
        style={lightVariant ? undefined : { textShadow: "0 1px 2px rgba(0,0,0,0.14)" }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Drop-in alias for backwards compatibility with the Alttavia LiquidGlassShell import.
 * Session 2 will migrate all usages to LiquidGlass directly.
 */
export { LiquidGlass as LiquidGlassShell };

/**
 * No-op: SVG filters are now inlined per instance.
 * Kept for backwards compat with layouts that mount <LiquidGlassDefs />.
 */
export function LiquidGlassDefs() {
  return null;
}
