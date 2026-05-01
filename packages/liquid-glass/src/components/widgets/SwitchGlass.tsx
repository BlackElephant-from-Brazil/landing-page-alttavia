"use client";

import { LiquidGlass } from "../LiquidGlass";

export type SwitchGlassProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
};

/**
 * Glass toggle switch. The thumb slides within a glass pill track.
 */
export function SwitchGlass({ checked, onChange, label, disabled = false }: SwitchGlassProps) {
  return (
    <label
      className={`inline-flex items-center gap-3 cursor-pointer select-none ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative w-14 h-8 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <LiquidGlass
          bezelWidth={12}
          power={6}
          strength={1.0}
          specular={{ opacity: 0.35, saturation: 1, angle: -1.05 }}
          borderRadius="9999px"
          lightVariant={!checked}
          tintOpacity={checked ? 0.6 : 0.25}
          blur={12}
          className="absolute inset-0 items-center"
          style={{ background: checked ? "rgba(208,161,43,0.35)" : undefined }}
        >
          {/* Thumb */}
          <span
            className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-200"
            style={{ left: checked ? "calc(100% - 1.75rem)" : "0.25rem" }}
          />
        </LiquidGlass>
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}
