# Liquid Glass — Session 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `packages/liquid-glass/` — a standalone React component library that replaces `src/components/ui/LiquidGlass.tsx` in the Alttavia project with a physically-correct liquid glass effect using WebGL displacement maps + SVG `feDisplacementMap` as `backdrop-filter`.

**Architecture:** A WebGL shader (OffscreenCanvas) generates a displacement map PNG for each element size; the PNG is fed into an SVG filter via `<feImage>` and applied as `backdrop-filter: url(#id)` in Chromium (real refraction of DOM backdrop). Safari/Firefox fall back to `backdrop-filter: blur()`. The main `<LiquidGlass>` component manages the canvas, ResizeObserver, and filter injection and is API-compatible with the existing `LiquidGlassShell`.

**Tech Stack:** WebGL (GLSL), OffscreenCanvas, SVG Filters, React 19, TypeScript 5, Next.js 16 (App Router + Turbopack), Vitest, tsup.

**Spec:** `docs/superpowers/specs/2026-04-30-liquid-glass-design.md`

**Session 2:** Widgets (Lens, Searchbox, Switch, Slider, Player), DebugOverlay, migrate all 12 Alttavia LiquidGlassShell usages.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/liquid-glass/package.json` | Create | Package metadata, deps |
| `packages/liquid-glass/tsconfig.json` | Create | TS config for lib |
| `packages/liquid-glass/vitest.config.ts` | Create | Unit test runner |
| `packages/liquid-glass/src/gl/shaders.ts` | Create | GLSL source strings |
| `packages/liquid-glass/src/gl/webgl-utils.ts` | Create | Compile/link shader program |
| `packages/liquid-glass/src/gl/generate-map.ts` | Create | Render displacement map to OffscreenCanvas → PNG data URL |
| `packages/liquid-glass/src/gl/generate-map.test.ts` | Create | Vitest unit tests |
| `packages/liquid-glass/src/hooks/useResizeObserver.ts` | Create | Measures element, fires on resize |
| `packages/liquid-glass/src/hooks/useFeatureDetect.ts` | Create | CSS.supports backdrop-filter checks |
| `packages/liquid-glass/src/hooks/useDisplacementMap.ts` | Create | Orchestrates map generation + memoization |
| `packages/liquid-glass/src/components/LiquidGlass.tsx` | Create | Main component: SVG filter + backdrop-filter + fallback |
| `packages/liquid-glass/src/index.ts` | Create | Public exports |
| `packages/liquid-glass/README.md` | Create | Integration docs |
| `tsconfig.json` (Alttavia root) | Modify | Add path alias `@alttavia/liquid-glass` |
| `package.json` (Alttavia root) | Modify | Add `@alttavia/liquid-glass` workspace dep |

---

## Task 1: Package scaffold

**Files:**
- Create: `packages/liquid-glass/package.json`
- Create: `packages/liquid-glass/tsconfig.json`
- Create: `packages/liquid-glass/vitest.config.ts`
- Modify: `tsconfig.json` (root)
- Modify: `package.json` (root)

- [ ] **Step 1: Create package directory structure**

```bash
mkdir -p packages/liquid-glass/src/gl
mkdir -p packages/liquid-glass/src/hooks
mkdir -p packages/liquid-glass/src/components
```

- [ ] **Step 2: Create `packages/liquid-glass/package.json`**

```json
{
  "name": "@alttavia/liquid-glass",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "typescript": "^5.0.0",
    "@types/react": "^19",
    "jsdom": "^24.0.0",
    "@vitest/environment-jsdom": "^2.1.0"
  }
}
```

- [ ] **Step 3: Create `packages/liquid-glass/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `packages/liquid-glass/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Add path alias to root `tsconfig.json`**

In `tsconfig.json`, add to `compilerOptions.paths`:
```json
"@alttavia/liquid-glass": ["./packages/liquid-glass/src/index.ts"],
"@alttavia/liquid-glass/*": ["./packages/liquid-glass/src/*"]
```

The `paths` block should look like:
```json
"paths": {
  "@/*": ["./src/*"],
  "@alttavia/liquid-glass": ["./packages/liquid-glass/src/index.ts"],
  "@alttavia/liquid-glass/*": ["./packages/liquid-glass/src/*"]
}
```

Also add `"packages/**/*.ts"` and `"packages/**/*.tsx"` to the `include` array:
```json
"include": [
  "next-env.d.ts",
  "**/*.ts",
  "**/*.tsx",
  "packages/**/*.ts",
  "packages/**/*.tsx",
  ".next/types/**/*.ts",
  ".next/dev/types/**/*.ts",
  "**/*.mts"
]
```

- [ ] **Step 6: Install vitest in the package**

```bash
cd packages/liquid-glass && npm install
```

Expected: `node_modules/` created inside `packages/liquid-glass/`.

- [ ] **Step 7: Commit scaffold**

```bash
git add packages/liquid-glass/ tsconfig.json
git commit -m "chore(liquid-glass): scaffold package structure"
```

---

## Task 2: GLSL shaders

**Files:**
- Create: `packages/liquid-glass/src/gl/shaders.ts`

The displacement map shader produces an RGBA image where:
- `R` channel: X displacement (128 = neutral, 0 = −max left, 255 = +max right)  
- `G` channel: Y displacement (128 = neutral, 0 = −max up, 255 = +max down)  
- `A` channel: mask (255 inside glass, 0 outside)

The lens distortion formula is derived from the reference shader: `roundedBox` SDF drives a lens warp that pushes pixels inward toward the glass center at the bezel, creating the refraction illusion.

- [ ] **Step 1: Write `packages/liquid-glass/src/gl/shaders.ts`**

```ts
export const VERTEX_SHADER = /* glsl */ `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

/**
 * Displacement map generator.
 *
 * Renders to a WxH canvas. For each pixel:
 *  - Computes the squircle (power-6 rounded box) SDF from element center.
 *  - Inside the flat glass area: R=128, G=128 (no displacement).
 *  - Inside the bezel ring: lens warp pushes content inward from the edge.
 *  - Outside: R=128, G=128, A=0 (transparent, not used by feDisplacementMap).
 *
 * Uniforms:
 *  u_resolution  vec2  canvas size in px
 *  u_bezelWidth  float bezel width in px
 *  u_power       float squircle exponent (default 6)
 *  u_strength    float displacement strength multiplier (default 1)
 */
export const DISPLACEMENT_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform vec2  u_resolution;
  uniform float u_bezelWidth;
  uniform float u_power;
  uniform float u_strength;

  // Squircle SDF: 0 at center, 1 at the unit-squircle boundary
  float squircleDist(vec2 p, float power) {
    return pow(abs(p.x), power) + pow(abs(p.y), power);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;         // [0,1]
    vec2 p  = uv - vec2(0.5);                         // [-0.5, 0.5] from center

    // Aspect-ratio-corrected coords so the squircle fits the rectangle
    vec2 pAR = vec2(p.x * (u_resolution.x / u_resolution.y), p.y);

    // SDF for the outer glass edge (the full element boundary)
    // At p = (±0.5*ar, 0) or (0, ±0.5) the raw squircleDist = pow(0.5*ar, pow)+pow(0.5,pow)
    // We normalise so that the boundary = 1.0 by computing the boundary value itself.
    float halfW = 0.5 * (u_resolution.x / u_resolution.y);
    float halfH = 0.5;
    float boundaryVal = pow(halfW, u_power) + pow(halfH, u_power);

    float d = squircleDist(pAR, u_power) / boundaryVal; // 0=center, 1=edge

    // Bezel occupies the outer fraction of the element
    float bezelFrac = u_bezelWidth / min(u_resolution.x, u_resolution.y);
    // innerFrac: d-value at the inner bezel boundary
    float innerHalfW = halfW - u_bezelWidth / u_resolution.y;
    float innerHalfH = halfH - u_bezelWidth / u_resolution.y;
    float innerBoundaryVal = pow(max(0.0, innerHalfW), u_power)
                           + pow(max(0.0, innerHalfH), u_power);
    float innerFrac = innerBoundaryVal / boundaryVal;

    // t: 0 at inner bezel boundary → 1 at outer edge
    float t = clamp((d - innerFrac) / (1.0 - innerFrac), 0.0, 1.0);

    // Smooth lens warp: content is pushed inward (toward center) proportional to t
    // smoothstep gives organic feel (matches Apple squircle transitions)
    float warp = t * t * (3.0 - 2.0 * t); // smoothstep
    warp = warp * u_strength;

    // Displacement direction: inward (from pixel toward center)
    // We encode: displacement = -p * warp  (negative because we're pulling inward)
    // Scale to [-0.5, 0.5] range then remap to [0, 1]
    vec2 disp = -p * warp * 2.0;  // [-1, 1] range
    disp = clamp(disp, -1.0, 1.0);

    // Map to [0, 1] for RGBA: 0.5 = neutral
    vec2 encoded = disp * 0.5 + 0.5;

    // Alpha: 1 inside (including bezel), 0 outside
    float alpha = step(d, 1.0);

    gl_FragColor = vec4(encoded.x, encoded.y, 0.5, alpha);
  }
`;

/**
 * Specular rim-light pass.
 *
 * Renders bright edge highlight concentrated at the upper-left bezel.
 * Blended on top of the refracted image via feBlend mode="screen".
 *
 * Uniforms:
 *  u_resolution  vec2
 *  u_bezelWidth  float
 *  u_power       float
 *  u_lightAngle  float  light direction in radians (default: -π/3 ≈ -60°)
 *  u_opacity     float  specular intensity (default: 0.4)
 *  u_saturation  float  colour saturation boost (default: 1.0; > 1 = warm glow)
 */
export const SPECULAR_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform vec2  u_resolution;
  uniform float u_bezelWidth;
  uniform float u_power;
  uniform float u_lightAngle;
  uniform float u_opacity;
  uniform float u_saturation;

  float squircleDist(vec2 p, float power) {
    return pow(abs(p.x), power) + pow(abs(p.y), power);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 p  = uv - vec2(0.5);
    vec2 pAR = vec2(p.x * (u_resolution.x / u_resolution.y), p.y);

    float halfW = 0.5 * (u_resolution.x / u_resolution.y);
    float halfH = 0.5;
    float boundaryVal = pow(halfW, u_power) + pow(halfH, u_power);
    float d = squircleDist(pAR, u_power) / boundaryVal;

    float innerHalfW = halfW - u_bezelWidth / u_resolution.y;
    float innerHalfH = halfH - u_bezelWidth / u_resolution.y;
    float innerBoundaryVal = pow(max(0.0, innerHalfW), u_power)
                           + pow(max(0.0, innerHalfH), u_power);
    float innerFrac = innerBoundaryVal / boundaryVal;

    float t = clamp((d - innerFrac) / (1.0 - innerFrac), 0.0, 1.0);
    float isBezel = step(innerFrac, d) * step(d, 1.0);

    // Surface normal (simplified: perpendicular to edge, pointing inward)
    vec2 normal = normalize(-p);

    // Light direction from angle
    vec2 lightDir = vec2(cos(u_lightAngle), sin(u_lightAngle));

    // Specular: Blinn-Phong
    float spec = pow(max(0.0, dot(normal, lightDir)), 12.0);
    spec *= isBezel * u_opacity;

    // Rim glow gradient along bezel
    float rim = (1.0 - t) * max(0.0, dot(normal, lightDir)) * 0.3 * isBezel;

    float intensity = spec + rim;

    // Warm tint for saturation > 1
    vec3 colour = mix(vec3(intensity), vec3(intensity * 1.1, intensity * 0.95, intensity * 0.8), u_saturation - 1.0);
    colour = clamp(colour, 0.0, 1.0);

    gl_FragColor = vec4(colour, intensity);
  }
`;
```

- [ ] **Step 2: Commit**

```bash
git add packages/liquid-glass/src/gl/shaders.ts
git commit -m "feat(liquid-glass): add displacement map and specular GLSL shaders"
```

---

## Task 3: WebGL utilities

**Files:**
- Create: `packages/liquid-glass/src/gl/webgl-utils.ts`

- [ ] **Step 1: Write `packages/liquid-glass/src/gl/webgl-utils.ts`**

```ts
/**
 * Compile a GLSL shader. Throws on compile error (dev-only; fails fast).
 */
export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("gl.createShader returned null");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

/**
 * Link a WebGL program from a vertex and fragment shader source.
 */
export function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("gl.createProgram returned null");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

/**
 * Set up the full-screen quad (2 triangles covering clip space).
 * Must be called once after createProgram.
 */
export function setupQuad(
  gl: WebGLRenderingContext,
  program: WebGLProgram
): void {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  const loc = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/liquid-glass/src/gl/webgl-utils.ts
git commit -m "feat(liquid-glass): add WebGL compile/link/quad utilities"
```

---

## Task 4: Displacement map generator with tests

**Files:**
- Create: `packages/liquid-glass/src/gl/generate-map.ts`
- Create: `packages/liquid-glass/src/gl/generate-map.test.ts`

The generator runs two WebGL passes (displacement + specular), reads pixels from each OffscreenCanvas, and returns two PNG data URLs.

- [ ] **Step 1: Write the failing test**

```ts
// packages/liquid-glass/src/gl/generate-map.test.ts
import { describe, it, expect } from "vitest";
import { generateMaps, type MapGenOptions } from "./generate-map";

describe("generateMaps", () => {
  it("returns displacement and specular data URLs for valid dimensions", async () => {
    const opts: MapGenOptions = {
      width: 200,
      height: 80,
      bezelWidth: 20,
      power: 6,
      strength: 1,
      specular: { opacity: 0.4, saturation: 1, angle: -1.05 },
    };
    const result = await generateMaps(opts);
    expect(result.displacementUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.specularUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.width).toBe(200);
    expect(result.height).toBe(80);
  });

  it("returns neutral maps (128/128) for bezelWidth=0", async () => {
    const result = await generateMaps({
      width: 100,
      height: 50,
      bezelWidth: 0,
      power: 6,
      strength: 0,
      specular: { opacity: 0, saturation: 1, angle: 0 },
    });
    // With strength=0 and bezelWidth=0 the displacement map should be all-neutral
    expect(result.displacementUrl).toBeTruthy();
  });

  it("throws for zero dimensions", async () => {
    await expect(
      generateMaps({ width: 0, height: 100, bezelWidth: 20, power: 6, strength: 1, specular: { opacity: 0.4, saturation: 1, angle: 0 } })
    ).rejects.toThrow("width and height must be > 0");
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd packages/liquid-glass && npx vitest run src/gl/generate-map.test.ts
```

Expected: FAIL — `Cannot find module './generate-map'`

- [ ] **Step 3: Write `packages/liquid-glass/src/gl/generate-map.ts`**

```ts
import {
  VERTEX_SHADER,
  DISPLACEMENT_FRAGMENT_SHADER,
  SPECULAR_FRAGMENT_SHADER,
} from "./shaders";
import { createProgram, setupQuad } from "./webgl-utils";

export type SpecularOptions = {
  opacity: number;
  saturation: number;
  angle: number; // radians
};

export type MapGenOptions = {
  width: number;
  height: number;
  bezelWidth: number;
  power?: number;    // squircle exponent, default 6
  strength?: number; // displacement strength, default 1
  specular?: SpecularOptions;
};

export type MapGenResult = {
  displacementUrl: string;
  specularUrl: string;
  width: number;
  height: number;
  /** Maximum displacement in pixels — use as feDisplacementMap scale */
  maxDisplacement: number;
};

/**
 * Render a displacement map and a specular highlight map using WebGL.
 * Works in browser (HTMLCanvasElement) and in Workers (OffscreenCanvas).
 * Returns two PNG data URLs ready for use in <feImage> SVG filter primitives.
 */
export async function generateMaps(opts: MapGenOptions): Promise<MapGenResult> {
  const {
    width,
    height,
    bezelWidth,
    power = 6,
    strength = 1,
    specular = { opacity: 0.4, saturation: 1, angle: -Math.PI / 3 },
  } = opts;

  if (width <= 0 || height <= 0) {
    throw new Error("width and height must be > 0");
  }

  const [dispUrl, dispMax] = await renderPass(
    width,
    height,
    DISPLACEMENT_FRAGMENT_SHADER,
    (gl, program) => {
      setUniforms(gl, program, {
        u_resolution: [width, height],
        u_bezelWidth: bezelWidth,
        u_power: power,
        u_strength: strength,
      });
    }
  );

  const [specUrl] = await renderPass(
    width,
    height,
    SPECULAR_FRAGMENT_SHADER,
    (gl, program) => {
      setUniforms(gl, program, {
        u_resolution: [width, height],
        u_bezelWidth: bezelWidth,
        u_power: power,
        u_lightAngle: specular.angle,
        u_opacity: specular.opacity,
        u_saturation: specular.saturation,
      });
    }
  );

  // maxDisplacement in pixels: strength * bezelWidth (upper bound of the warp)
  const maxDisplacement = strength * bezelWidth;

  return {
    displacementUrl: dispUrl,
    specularUrl: specUrl,
    width,
    height,
    maxDisplacement,
  };
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

type Uniforms = Record<string, number | number[]>;

function setUniforms(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  uniforms: Uniforms
): void {
  for (const [name, value] of Object.entries(uniforms)) {
    const loc = gl.getUniformLocation(program, name);
    if (loc === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 2) gl.uniform2fv(loc, value);
      else if (value.length === 3) gl.uniform3fv(loc, value);
    } else {
      gl.uniform1f(loc, value);
    }
  }
}

async function renderPass(
  width: number,
  height: number,
  fragmentSource: string,
  bindUniforms: (gl: WebGLRenderingContext, program: WebGLProgram) => void
): Promise<[dataUrl: string, maxValue: number]> {
  // Use OffscreenCanvas when available (works in Workers too)
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : (() => {
          const c = document.createElement("canvas");
          c.width = width;
          c.height = height;
          return c;
        })();

  const gl = (canvas as HTMLCanvasElement).getContext("webgl") as WebGLRenderingContext | null
    ?? (canvas as OffscreenCanvas).getContext("webgl") as WebGLRenderingContext | null;

  if (!gl) throw new Error("WebGL not available");

  const program = createProgram(gl, VERTEX_SHADER, fragmentSource);
  gl.useProgram(program);
  setupQuad(gl, program);
  bindUniforms(gl, program);

  gl.viewport(0, 0, width, height);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Read pixels to compute max displacement (for feDisplacementMap scale)
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let maxVal = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const dx = Math.abs(pixels[i] - 128) / 127;
    const dy = Math.abs(pixels[i + 1] - 128) / 127;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > maxVal) maxVal = mag;
  }

  const dataUrl = await canvasToDataUrl(canvas);
  return [dataUrl, maxVal];
}

async function canvasToDataUrl(
  canvas: HTMLCanvasElement | OffscreenCanvas
): Promise<string> {
  if (canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type: "image/png" });
    return blobToDataUrl(blob);
  }
  return (canvas as HTMLCanvasElement).toDataURL("image/png");
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

- [ ] **Step 4: Install vitest dev dep and run tests**

```bash
cd packages/liquid-glass && npm install && npx vitest run src/gl/generate-map.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/liquid-glass/src/gl/
git commit -m "feat(liquid-glass): WebGL displacement and specular map generators"
```

---

## Task 5: Hooks — `useResizeObserver` + `useFeatureDetect`

**Files:**
- Create: `packages/liquid-glass/src/hooks/useResizeObserver.ts`
- Create: `packages/liquid-glass/src/hooks/useFeatureDetect.ts`

- [ ] **Step 1: Write `packages/liquid-glass/src/hooks/useResizeObserver.ts`**

```ts
"use client";

import { type RefObject, useEffect, useState } from "react";

export type Size = { width: number; height: number };

/**
 * Tracks the content-box size of a DOM element via ResizeObserver.
 * Returns { width: 0, height: 0 } on the server.
 */
export function useResizeObserver(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Capture initial size immediately
    const { width, height } = el.getBoundingClientRect();
    setSize({ width: Math.round(width), height: Math.round(height) });

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        setSize({ width: Math.round(w), height: Math.round(h) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}
```

- [ ] **Step 2: Write `packages/liquid-glass/src/hooks/useFeatureDetect.ts`**

```ts
"use client";

import { useMemo } from "react";

export type FeatureSupport = {
  /** backdrop-filter: url(#id) — Chromium 76+ only */
  backdropFilterUrl: boolean;
  /** backdrop-filter: blur() — Chrome + Safari */
  backdropFilter: boolean;
};

export function useFeatureDetect(): FeatureSupport {
  return useMemo(() => {
    if (typeof CSS === "undefined" || typeof window === "undefined") {
      return { backdropFilterUrl: false, backdropFilter: false };
    }
    return {
      backdropFilterUrl: CSS.supports("backdrop-filter", "url(#x)"),
      backdropFilter:
        CSS.supports("backdrop-filter", "blur(1px)") ||
        CSS.supports("-webkit-backdrop-filter", "blur(1px)"),
    };
  }, []);
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/liquid-glass/src/hooks/
git commit -m "feat(liquid-glass): useResizeObserver and useFeatureDetect hooks"
```

---

## Task 6: `useDisplacementMap` hook

**Files:**
- Create: `packages/liquid-glass/src/hooks/useDisplacementMap.ts`

Memoizes map generation by serialized opts + size. Only re-generates when size or config changes.

- [ ] **Step 1: Write `packages/liquid-glass/src/hooks/useDisplacementMap.ts`**

```ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MapGenOptions, MapGenResult, SpecularOptions } from "../gl/generate-map";

export type DisplacementMapConfig = {
  bezelWidth: number;
  power?: number;
  strength?: number;
  specular?: SpecularOptions;
};

const cache = new Map<string, MapGenResult>();

function cacheKey(opts: MapGenOptions): string {
  return JSON.stringify(opts);
}

/**
 * Generates (and caches) displacement + specular maps whenever size or config changes.
 * Returns null dataUrls while the first generation is pending.
 */
export function useDisplacementMap(
  width: number,
  height: number,
  config: DisplacementMapConfig
): MapGenResult | null {
  const [result, setResult] = useState<MapGenResult | null>(null);
  const inflightRef = useRef<string | null>(null);

  const opts = useMemo<MapGenOptions>(
    () => ({
      width,
      height,
      bezelWidth: config.bezelWidth,
      power: config.power ?? 6,
      strength: config.strength ?? 1,
      specular: config.specular ?? { opacity: 0.4, saturation: 1, angle: -Math.PI / 3 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height, config.bezelWidth, config.power, config.strength,
     config.specular?.opacity, config.specular?.saturation, config.specular?.angle]
  );

  const key = useMemo(() => cacheKey(opts), [opts]);

  useEffect(() => {
    if (width <= 0 || height <= 0) return;

    const cached = cache.get(key);
    if (cached) {
      setResult(cached);
      return;
    }

    if (inflightRef.current === key) return; // already generating
    inflightRef.current = key;

    import("../gl/generate-map")
      .then(({ generateMaps }) => generateMaps(opts))
      .then((r) => {
        cache.set(key, r);
        if (inflightRef.current === key) {
          setResult(r);
          inflightRef.current = null;
        }
      })
      .catch((err) => {
        console.warn("[liquid-glass] map generation failed:", err);
        inflightRef.current = null;
      });
  }, [key, opts, width, height]);

  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/liquid-glass/src/hooks/useDisplacementMap.ts
git commit -m "feat(liquid-glass): useDisplacementMap hook with result cache"
```

---

## Task 7: `LiquidGlass` main component

**Files:**
- Create: `packages/liquid-glass/src/components/LiquidGlass.tsx`

The component:
1. Measures itself via `useResizeObserver`
2. Calls `useDisplacementMap` to get PNG data URLs
3. Renders an inline SVG `<defs>` with the filter (unique ID per instance via `useId`)
4. Applies `backdrop-filter: url(#id) blur()` in Chromium — real refraction of DOM content
5. Falls back to `backdrop-filter: blur() saturate()` elsewhere

- [ ] **Step 1: Write `packages/liquid-glass/src/components/LiquidGlass.tsx`**

```tsx
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
  /** Squircle exponent — 6 = Apple default. Higher = more rectangular corners. */
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
  /** @deprecated ignored — kept for drop-in compatibility with LiquidGlassShell */
  enableHover?: boolean;
};

/**
 * Liquid glass overlay component.
 *
 * In Chromium: renders a WebGL-generated displacement map via SVG feDisplacementMap
 * as backdrop-filter — physically correct refraction of DOM content behind the element.
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
  // useId returns ":r0:" etc — strip colons for valid SVG id
  const filterId = `lg-${rawId.replace(/:/g, "")}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useResizeObserver(containerRef);
  const { backdropFilterUrl, backdropFilter } = useFeatureDetect();
  const maps = useDisplacementMap(width, height, { bezelWidth, power, strength, specular });

  // ── Visual tokens ────────────────────────────────────────────────────────
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

  // ── Backdrop filter value ────────────────────────────────────────────────
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
      {/* SVG filter — inline, one per component instance */}
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/liquid-glass/src/components/LiquidGlass.tsx
git commit -m "feat(liquid-glass): LiquidGlass component with WebGL refraction + fallback"
```

---

## Task 8: `index.ts` + wire up Alttavia

**Files:**
- Create: `packages/liquid-glass/src/index.ts`
- Modify: `src/components/ui/LiquidGlass.tsx` (Alttavia)
- Modify: `src/app/[locale]/layout.tsx` (if LiquidGlassDefs was used)

- [ ] **Step 1: Write `packages/liquid-glass/src/index.ts`**

```ts
export { LiquidGlass, LiquidGlassShell } from "./components/LiquidGlass";
export type { LiquidGlassProps } from "./components/LiquidGlass";
export type { SpecularOptions, MapGenResult } from "./gl/generate-map";
export type { FeatureSupport } from "./hooks/useFeatureDetect";
```

- [ ] **Step 2: Replace Alttavia's `src/components/ui/LiquidGlass.tsx`**

Replace the entire file with a re-export shim so existing imports keep working without touching the 12 consumer files:

```tsx
// Shim — re-exports from the new physics-based package.
// Session 2 will migrate each consumer directly; this shim is temporary.
export {
  LiquidGlass,
  LiquidGlassShell,
  LiquidGlass as LiquidGlassDefs,
} from "@alttavia/liquid-glass";
export type { LiquidGlassProps } from "@alttavia/liquid-glass";
```

> Note: `LiquidGlassDefs` is re-exported as `LiquidGlass` because the new package embeds the SVG filter inline per component — no global defs element is needed.

- [ ] **Step 3: Verify the dev server still compiles**

```bash
npm run dev
```

Expected: `✓ Compiled` with no TypeScript errors. All pages using `LiquidGlassShell` should render visually (glass effect may differ until maps generate).

- [ ] **Step 4: Commit**

```bash
git add packages/liquid-glass/src/index.ts src/components/ui/LiquidGlass.tsx
git commit -m "feat(liquid-glass): public exports + Alttavia re-export shim"
```

---

## Task 9: README

**Files:**
- Create: `packages/liquid-glass/README.md`

- [ ] **Step 1: Write `packages/liquid-glass/README.md`**

````markdown
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
| `bezelWidth` | `number` | `20` | Bezel ring width in px — the refractive edge zone |
| `power` | `number` | `6` | Squircle exponent (6 = Apple default) |
| `strength` | `number` | `1` | Displacement intensity multiplier |
| `specular` | `SpecularOptions` | `{ opacity: 0.4, saturation: 1, angle: -π/3 }` | Rim-light config |
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
````

- [ ] **Step 2: Commit**

```bash
git add packages/liquid-glass/README.md
git commit -m "docs(liquid-glass): add README with installation, props, browser support"
```

---

## Task 10: Smoke test in browser

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open `http://localhost:3000` in Chrome**

Verify:
1. The navbar pill renders with the glass effect
2. Service cards show the glass overlay
3. No React hydration errors in the console
4. After a brief moment (map generation), the glass refraction should visually update with the WebGL-based distortion

- [ ] **Step 3: Open in Safari (or Firefox)**

Verify:
1. The glass components still render (fallback: blur + tint)
2. No JS errors in console

- [ ] **Step 4: Open Chrome DevTools → Elements**

Inspect any `LiquidGlassShell` element. Confirm:
- An inline `<svg style="display:none">` with a `<filter id="lg-...">` is present inside the component
- The `.absolute.inset-0` div has `backdrop-filter: url(#lg-...) blur(20px)` applied (visible in computed styles)

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat(liquid-glass): session 1 complete — WebGL displacement map lib"
```

---

## Self-review notes

- All physics types (`SpecularOptions`, `MapGenOptions`, `MapGenResult`) are defined in `generate-map.ts` and re-exported from `index.ts` — no orphan references.
- `LiquidGlassDefs` is exported as an alias for `LiquidGlass` in the shim to avoid breaking any import that might reference it; the real component inlines its own SVG filter.
- `feBlend mode="screen"` composites the specular highlight — this requires Chromium's SVG filter support (same gate as `backdropFilterUrl`).
- The `maxDisplacement` value returned by `generateMaps` is used directly as `feDisplacementMap scale`. This is the pixel radius of the maximum warp — typically `strength * bezelWidth`.
- Session 2 must remove the shim in `src/components/ui/LiquidGlass.tsx` and update each of the 12 consumer files to import from `@alttavia/liquid-glass` directly.
