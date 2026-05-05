# Liquid Glass — Design Spec
**Date:** 2026-04-30  
**Status:** Approved for implementation  
**Sessions:** 2 (Session 1 = core lib; Session 2 = widgets + docs + Alttavia migration)

---

## 1. Objetivo

Substituir o efeito de vidro atual do projeto Alttavia (baseado em `feTurbulence` + distorção fake) por uma implementação fisicamente correta do Apple Liquid Glass (WWDC 2025), publicável como pacote npm local reutilizável em outros projetos.

---

## 2. Estrutura do pacote

```
packages/liquid-glass/
├── src/
│   ├── physics/
│   │   ├── refraction.ts
│   │   ├── surface.ts
│   │   ├── displacement-field.ts
│   │   └── generate-map.ts
│   ├── workers/
│   │   └── map-generator.worker.ts
│   ├── components/
│   │   ├── LiquidGlassDefs.tsx
│   │   ├── LiquidGlass.tsx
│   │   └── widgets/
│   │       ├── LensGlass.tsx
│   │       ├── SearchboxGlass.tsx
│   │       ├── SwitchGlass.tsx
│   │       ├── SliderGlass.tsx
│   │       └── PlayerGlass.tsx
│   ├── hooks/
│   │   ├── useDisplacementMap.ts
│   │   └── useFeatureDetect.ts
│   ├── debug/
│   │   └── DebugOverlay.tsx
│   └── index.ts
├── package.json        (name: "@alttavia/liquid-glass")
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

O Alttavia referencia o pacote com `"@alttavia/liquid-glass": "file:../../packages/liquid-glass"` no `package.json`.

---

## 3. Módulos de física

### 3.1 `refraction.ts`

Implementa a Lei de Snell. Simplificações conforme o artigo de referência:
- Meio de entrada: n₁ = 1 (ar)
- Meio do vidro: n₂ configurável (padrão 1.5)
- Uma única refração (entrada do raio)
- Raios incidentes ortogonais ao plano de fundo

```ts
function refract(θIncidence: number, n1: number, n2: number): number | null
// Retorna null quando sin(θ) > n2/n1 (reflexão total interna)
```

### 3.2 `surface.ts`

Quatro funções de altura `f(x): x ∈ [0,1]` onde 0 = borda externa, 1 = início do plano plano:

| Tipo | Fórmula |
|------|---------|
| `circle` | `√(1 − (1−x)²)` |
| `squircle` (padrão) | `⁴√(1 − (1−x)⁴)` |
| `concave` | `1 − circle(x)` |
| `lip` | `mix(circle, concave, smootherstep(x))` |

Normal calculada via derivada numérica com delta = 0.001:
```ts
const slope = (f(x + delta) − f(x − delta)) / (2 * delta)
const normal = { nx: −slope, ny: 1 }  // normalizado
```

### 3.3 `displacement-field.ts`

Pré-calcula 127 amostras ao longo do bezel (meia-fatia radial), explora simetria rotacional para evitar recálculo completo.

```ts
function buildField(opts: {
  bezelWidth: number    // largura do anel refrativo em px
  n2: number            // índice refrativo
  surface: SurfaceType
}): { samples: FieldSample[]; maxDisplacement: number }

type FieldSample = { distanceFromEdge: number; angle: number; magnitude: number }
```

Todas as magnitudes são normalizadas por `maxDisplacement` (guardado separadamente — vira o `scale` do `feDisplacementMap`).

### 3.4 `generate-map.ts`

Converte campo polar → PNG RGBA via OffscreenCanvas (ou Canvas em fallback):

```
r = 128 + cos(angle) × magnitude × 127   // deslocamento X
g = 128 + sin(angle) × magnitude × 127   // deslocamento Y
b = 128
a = 255
```

Exporta `{ dataUrl: string; width: number; height: number }`.

---

## 4. Web Worker

`map-generator.worker.ts` roda `buildField` + `generateDisplacementMap` fora da thread principal usando `OffscreenCanvas`. O hook `useDisplacementMap` envia uma mensagem `{ type: 'generate', opts }` e recebe `{ type: 'result', dataUrl, maxDisplacement }`.

Fallback: se `OffscreenCanvas` não estiver disponível, o hook roda a geração na thread principal.

---

## 5. Filtro SVG

```tsx
// LiquidGlassDefs.tsx — colocado 1x na raiz do app (ex.: layout.tsx)
<svg style={{ display: 'none' }}>
  <defs>
    <filter id="liquid-glass-{id}" colorInterpolationFilters="sRGB">
      <feImage href={mapDataUrl} result="map" />
      <feDisplacementMap
        in="SourceGraphic"
        in2="map"
        scale={maxDisplacement}
        xChannelSelector="R"
        yChannelSelector="G"
        result="refracted"
      />
      <feImage href={specularDataUrl} result="specular" />
      <feBlend in="refracted" in2="specular" mode="screen" />
    </filter>
  </defs>
</svg>
```

O `feDisplacementMap.scale` é o único número de intensidade — igual ao `maxDisplacement` em pixels calculado pelo campo.

---

## 6. Specular Highlight (Fase 6)

Imagem de borda iluminada gerada por canvas com intensidade proporcional ao produto interno `normal · lightDir`. Parâmetros expostos:

```ts
type SpecularOptions = {
  opacity: number      // 0–1, padrão 0.4
  saturation: number   // multiplicador de saturação, padrão 6
  angle: number        // direção da luz em graus, padrão -60
}
```

Blended via `<feBlend mode="screen">` sobre o resultado da refração.

---

## 7. API React principal

```tsx
// Uso básico
<LiquidGlass
  surface="squircle"           // 'circle' | 'squircle' | 'concave' | 'lip'
  bezelWidth={20}              // px
  glassThickness={1.5}         // índice refrativo n₂
  scaleRatio={1.0}             // multiplicador do maxDisplacement
  specular={{ opacity: 0.4, saturation: 6, angle: -60 }}
  blur={1.0}                   // backdrop blur adicional
  lightVariant={false}         // tint claro (branco) vs escuro
  tintOpacity={0.06}
  borderRadius="24px"
  debug={false}                // ativa DebugOverlay
>
  {children}
</LiquidGlass>

// Alias de retrocompatibilidade (para migração gradual do Alttavia)
export { LiquidGlass as LiquidGlassShell }
```

Internamente, `LiquidGlass`:
1. Mede o elemento com `ResizeObserver`
2. Chama `useDisplacementMap(opts)` (memoizado, regenera só se props/tamanho mudam)
3. Renderiza o filtro SVG inline (ou referencia o `LiquidGlassDefs` global)
4. Aplica `backdrop-filter: url(#liquid-glass-{id}) blur(Xpx)` no elemento de efeito
5. Fallback automático: se `CSS.supports('backdrop-filter', 'url(#x)')` = false → `backdrop-filter: blur(Xpx)` + camada translúcida

---

## 8. Hooks

### `useDisplacementMap`
```ts
function useDisplacementMap(opts: {
  surface: SurfaceType
  bezelWidth: number
  n2: number
  scaleRatio: number
  specular: SpecularOptions
  width: number
  height: number
}): { dataUrl: string | null; specularUrl: string | null; maxDisplacement: number }
```

Memoiza por `(surface, bezelWidth, n2, scaleRatio, specular, width, height)`. Usa Web Worker quando disponível.

### `useFeatureDetect`
```ts
function useFeatureDetect(): {
  supportsBackdropFilterUrl: boolean  // Chromium only
  supportsBackdropFilter: boolean     // Chrome + Safari
}
```

---

## 9. Debug Overlay (Fase 8 / Sessão 2)

Ativado por `<LiquidGlass debug>`. Renderiza side-by-side:
- Esquerda: displacement map PNG visualizado (vermelho = X, verde = Y)
- Direita: ray-tracing diagram (raios incidentes, normais, raios refratados)

---

## 10. Widgets (Sessão 2)

| Widget | Surface padrão | n₂ | Nota |
|--------|---------------|-----|------|
| `LensGlass` | `circle` | 1.7 | Dois displacement maps: lateral + zoom central |
| `SearchboxGlass` | `squircle` | 1.3 | Refração leve |
| `SwitchGlass` | `lip` | 1.5 | "Zoom" no slider |
| `SliderGlass` | `circle` | 1.5 | Bezel convexo total |
| `PlayerGlass` | `squircle` | 1.4 | Squircle + specular sutil |

---

## 11. Migração do Alttavia (Sessão 2)

Os 12 arquivos que usam `LiquidGlassShell` serão migrados para `@alttavia/liquid-glass`:

```
src/components/sections/navbar.tsx       → LiquidGlass lightVariant blur=24
src/components/sections/hero.tsx         → LiquidGlass lightVariant
src/components/sections/services.tsx     → LiquidGlass lightVariant
src/components/sections/why-us.tsx       → LiquidGlass (dark)
src/components/sections/about.tsx        → LiquidGlass lightVariant
src/components/sections/principles.tsx   → LiquidGlass (dark)
src/components/sections/faq.tsx          → LiquidGlass lightVariant
src/components/sections/cta-banner.tsx   → LiquidGlass (dark)
src/components/sections/contact.tsx      → LiquidGlass lightVariant
src/components/sections/location.tsx     → LiquidGlass lightVariant
src/components/sections/footer.tsx       → LiquidGlass (dark)
src/components/ui/spinning-badge.tsx     → LiquidGlass lightVariant
```

O export `LiquidGlassDefs` precisa ser colocado no `src/app/[locale]/layout.tsx`.

---

## 12. Divisão das sessões

### Sessão 1 — Core lib
- `packages/liquid-glass/` scaffolding completo (package.json, tsconfig, tsup)
- `physics/` todos os 4 módulos
- `workers/map-generator.worker.ts`
- `hooks/useDisplacementMap.ts` + `hooks/useFeatureDetect.ts`
- `components/LiquidGlassDefs.tsx`
- `components/LiquidGlass.tsx` (componente principal com fallback)
- `index.ts` (exports)
- Testes unitários dos módulos de física (Vitest)
- `README.md` do pacote

### Sessão 2 — Widgets + integração
- `components/widgets/` todos os 5 widgets
- `debug/DebugOverlay.tsx`
- Migração dos 12 arquivos do Alttavia
- Atualização do `src/app/[locale]/layout.tsx` com `<LiquidGlassDefs>`
- Remoção do `LiquidGlass.tsx` legado do Alttavia
- Documentação de integração no README principal

---

## 13. Build config

`tsup.config.ts`: formato `ESM + CJS`, tipos gerados, entrada `src/index.ts`. Workers bundlados separadamente como `liquid-glass.worker.js` (inline via URL string para compatibilidade universal).

## 14. Detecção de feature e fallback

```
Chromium → backdrop-filter: url(#liquid-glass-X) blur(Xpx)   [refração física completa]
Safari   → backdrop-filter: blur(Xpx) saturate(140%)          [blur nativo]
Firefox  → background: rgba(...) blur() via filter             [opaco translúcido]
```

Detecção via `CSS.supports('backdrop-filter', 'url(#x)')` no lado do cliente.
