"use client";

import { type ReactNode, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

// ─── SVG filters ──────────────────────────────────────────────────────────────

export function LiquidGlassDefs() {
  return (
    <svg
      style={{ display: "none", position: "absolute", width: 0, height: 0 }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Standard glass distortion */}
        <filter
          id="glass-distortion"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          filterUnits="objectBoundingBox"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.01 0.01"
            numOctaves="1"
            seed="5"
            result="turbulence"
          />
          <feComponentTransfer in="turbulence" result="mapped">
            <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
            <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
            <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
          </feComponentTransfer>
          <feGaussianBlur in="mapped" stdDeviation="3" result="softMap" />
          <feSpecularLighting
            in="softMap"
            surfaceScale="5"
            specularConstant="1"
            specularExponent="100"
            lightingColor="white"
            result="specLight"
          >
            <fePointLight x="-200" y="-200" z="300" />
          </feSpecularLighting>
          <feComposite
            in="specLight"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="1"
            k4="0"
            result="litImage"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softMap"
            scale="150"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Softer distortion for search / dropdowns */}
        <filter
          id="glass-distortion-soft"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          filterUnits="objectBoundingBox"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.008"
            numOctaves="1"
            seed="7"
            result="turbulence"
          />
          <feComponentTransfer in="turbulence" result="mapped">
            <feFuncR type="gamma" amplitude="1" exponent="6" offset="0.5" />
            <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
            <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
          </feComponentTransfer>
          <feGaussianBlur in="mapped" stdDeviation="2.5" result="softMap" />
          <feSpecularLighting
            in="softMap"
            surfaceScale="3.5"
            specularConstant="0.8"
            specularExponent="60"
            lightingColor="white"
            result="specLight"
          >
            <fePointLight x="-180" y="-180" z="260" />
          </feSpecularLighting>
          <feComposite
            in="specLight"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="1"
            k4="0"
            result="litImage"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softMap"
            scale="60"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

// ─── Core shell ────────────────────────────────────────────────────────────────

interface LiquidGlassShellProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  tintOpacity?: number;
  blur?: number;
  filter?: "glass-distortion" | "glass-distortion-soft" | "none";
  enableHover?: boolean;
  borderRadius?: string;
  lightVariant?: boolean;
  style?: React.CSSProperties;
}

export function LiquidGlassShell({
  children,
  className = "",
  contentClassName = "",
  tintOpacity = 0.55,
  blur = 20,
  filter = "glass-distortion",
  enableHover = false,
  borderRadius,
  lightVariant = false,
  style,
}: LiquidGlassShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springCfg = { damping: 25, stiffness: 150 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [2, -2]), springCfg);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-2, 2]), springCfg);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - r.left) / r.width - 0.5);
    mouseY.set((e.clientY - r.top) / r.height - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const radiusStyle = borderRadius ? { borderRadius } : undefined;

  const tintColor = lightVariant
    ? `rgba(255, 255, 255, ${tintOpacity})`
    : `rgba(18, 18, 18, ${tintOpacity})`;

  const borderColor = lightVariant
    ? "rgba(255, 255, 255, 0.50)"
    : "rgba(255, 255, 255, 0.12)";

  const outerShadow = lightVariant
    ? "0 4px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(208,161,43,0.08)"
    : "0 4px 24px rgba(0, 0, 0, 0.1), 0 0 1px rgba(255, 255, 255, 0.1)";

  const shineGradient = lightVariant
    ? "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.10) 100%)"
    : "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.04) 100%)";

  return (
    <motion.div
      ref={containerRef}
      className={`relative flex ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...radiusStyle,
        rotateX: 0,
        rotateY: 0,
        boxShadow: outerShadow,
        ...style,
      }}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      whileHover={
        enableHover
          ? {
              scale: 1.01,
              transition: { duration: 0.4, ease: [0.175, 0.885, 0.32, 2.2] },
            }
          : {}
      }
    >
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ borderRadius: "inherit" }}
      >
        <div
          className="absolute inset-0 z-0"
          style={{
            backdropFilter: `blur(${blur}px) saturate(140%)`,
            WebkitBackdropFilter: `blur(${blur}px) saturate(140%)`,
            ...(filter !== "none"
              ? { filter: `url(#${filter})`, isolation: "isolate" }
              : {}),
          }}
        />
        <div
          className="absolute inset-0 z-[1]"
          style={{ background: tintColor }}
        />
        <div
          className="absolute inset-0 z-[2]"
          style={{
            boxShadow:
              "inset 1px 1px 0 0 rgba(255, 255, 255, 0.12), inset -1px -1px 0 0 rgba(255, 255, 255, 0.06)",
            background: shineGradient,
          }}
        />
      </div>

      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          borderRadius: "inherit",
          border: `1px solid ${borderColor}`,
        }}
      />

      <div
        className={`relative z-[3] w-full ${lightVariant ? "" : "text-white"} ${contentClassName}`}
        style={lightVariant ? undefined : { textShadow: "0 1px 2px rgba(0,0,0,0.14)" }}
      >
        {children}
      </div>
    </motion.div>
  );
}
