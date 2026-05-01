"use client";

import { type InputHTMLAttributes } from "react";
import { LiquidGlass } from "../LiquidGlass";

export type SearchboxGlassProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className"
> & {
  containerClassName?: string;
  inputClassName?: string;
};

/**
 * Glass input field with squircle light refraction.
 */
export function SearchboxGlass({
  containerClassName = "",
  inputClassName = "",
  ...inputProps
}: SearchboxGlassProps) {
  return (
    <LiquidGlass
      bezelWidth={14}
      power={6}
      strength={0.5}
      specular={{ opacity: 0.2, saturation: 1, angle: -1.05 }}
      borderRadius="9999px"
      lightVariant
      tintOpacity={0.12}
      blur={16}
      className={`items-center ${containerClassName}`}
      contentClassName="px-4 py-2"
    >
      <input
        {...inputProps}
        className={`bg-transparent outline-none w-full text-sm placeholder:text-black/40 text-black ${inputClassName}`}
      />
    </LiquidGlass>
  );
}
