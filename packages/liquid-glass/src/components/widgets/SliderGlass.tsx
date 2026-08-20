"use client";

import { type ChangeEvent } from "react";
import { LiquidGlass } from "../LiquidGlass";

export type SliderGlassProps = {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  className?: string;
};

/**
 * Glass range slider. The thumb has a convex circular bezel (power=2).
 */
export function SliderGlass({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  label,
  className = "",
}: SliderGlassProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && <span className="text-sm text-current/70">{label}</span>}
      <div className="relative flex items-center h-8">
        {/* Track */}
        <LiquidGlass
          bezelWidth={6}
          power={6}
          strength={0.4}
          specular={{ opacity: 0.15, saturation: 1, angle: -1.05 }}
          borderRadius="9999px"
          lightVariant
          tintOpacity={0.18}
          blur={8}
          className="w-full h-2 items-center overflow-hidden"
        >
          {/* Fill */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-current/20"
            style={{ width: `${pct}%` }}
          />
        </LiquidGlass>

        {/* Thumb -- a small glass circle that moves along the track */}
        <div
          className="absolute -translate-x-1/2"
          style={{ left: `${pct}%` }}
        >
          <LiquidGlass
            bezelWidth={10}
            power={2}
            strength={1.2}
            specular={{ opacity: 0.5, saturation: 1.1, angle: -1.05 }}
            borderRadius="9999px"
            lightVariant
            tintOpacity={0.3}
            blur={10}
            style={{ width: 28, height: 28 }}
            className="items-center justify-center shrink-0"
          />
        </div>

        {/* Native range for interaction (invisible, sits on top) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
          aria-label={label}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}
