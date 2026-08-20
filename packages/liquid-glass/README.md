# @alttavia/liquid-glass

Physics-based liquid glass UI component for React. Implements the Apple WWDC 2025 Liquid Glass visual using:

- **WebGL** (GLSL shader) to generate a displacement map from a squircle SDF
- **SVG `feDisplacementMap`** as `backdrop-filter` for real refraction of DOM content (Chromium)
- **CSS `backdrop-filter: blur()`** fallback for Safari and Firefox

## Installation (monorepo local)

Already wired up in this repo via `tsconfig.json` path alias. In an external project:

```bash
npm install @alttavia/liquid-glass
```

## Usage

```tsx
import { LiquidGlass } from "@alttavia/liquid-glass";

export function Card() {
  return (
    <LiquidGlass
      bezelWidth={20}
      blur={20}
      lightVariant
      borderRadius="24px"
    >
      <p>Content here</p>
    </LiquidGlass>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `bezelWidth` | `number` | `20` | Bezel ring width in px -- the refractive edge zone |
| `power` | `number` | `6` | Squircle exponent (6 = Apple default) |
| `strength` | `number` | `1` | Displacement intensity multiplier |
| `specular` | `SpecularOptions` | `{ opacity: 0.4, saturation: 1, angle: -pi/3 }` | Rim-light config |
| `blur` | `number` | `20` | Additional backdrop blur in px |
| `lightVariant` | `boolean` | `false` | White tint for light surfaces |
| `tintOpacity` | `number` | `0.55` | Background tint opacity |
| `borderRadius` | `string` | `"24px"` | CSS border-radius |

## Browser support

| Browser | Effect |
|---------|--------|
| Chromium 76+ | Full WebGL displacement map refraction |
| Safari | `backdrop-filter: blur()` + tint |
| Firefox | `backdrop-filter: blur()` + tint |

## Session 2 (upcoming)

- 5 UI widgets: `LensGlass`, `SearchboxGlass`, `SwitchGlass`, `SliderGlass`, `PlayerGlass`
- `DebugOverlay` for inspecting displacement maps
- Full migration of all Alttavia `LiquidGlassShell` usages
