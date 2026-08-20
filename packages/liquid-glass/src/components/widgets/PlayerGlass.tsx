"use client";

import { type ReactNode } from "react";
import { LiquidGlass } from "../LiquidGlass";

export type PlayerGlassProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Glass container for media player controls.
 * Squircle surface with subtle specular highlight.
 */
export function PlayerGlass({ children, className = "", contentClassName = "" }: PlayerGlassProps) {
  return (
    <LiquidGlass
      bezelWidth={20}
      power={6}
      strength={0.7}
      specular={{ opacity: 0.3, saturation: 1.2, angle: -1.05 }}
      borderRadius="16px"
      tintOpacity={0.5}
      blur={20}
      className={className}
      contentClassName={`p-4 flex items-center gap-4 ${contentClassName}`}
    >
      {children}
    </LiquidGlass>
  );
}
