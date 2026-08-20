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
 * Returns null while the first generation is pending.
 *
 * Generation is deferred to idle time (requestIdleCallback) so that many components
 * mounting simultaneously do not compete for the GPU in a burst.
 */
export function useDisplacementMap(
  width: number,
  height: number,
  config: DisplacementMapConfig
): MapGenResult | null {
  const [result, setResult] = useState<MapGenResult | null>(null);
  const inflightRef = useRef<string | null>(null);
  const idleHandleRef = useRef<number | ReturnType<typeof setTimeout> | null>(null);

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

    // Cancel any previously scheduled generation for a different size/config.
    if (idleHandleRef.current !== null) {
      if (typeof requestIdleCallback !== "undefined") {
        cancelIdleCallback(idleHandleRef.current as number);
      } else {
        clearTimeout(idleHandleRef.current as ReturnType<typeof setTimeout>);
      }
      idleHandleRef.current = null;
    }

    const run = () => {
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
    };

    if (typeof requestIdleCallback !== "undefined") {
      idleHandleRef.current = requestIdleCallback(run, { timeout: 2000 });
    } else {
      idleHandleRef.current = setTimeout(run, 50);
    }

    return () => {
      if (idleHandleRef.current !== null) {
        if (typeof requestIdleCallback !== "undefined") {
          cancelIdleCallback(idleHandleRef.current as number);
        } else {
          clearTimeout(idleHandleRef.current as ReturnType<typeof setTimeout>);
        }
        idleHandleRef.current = null;
      }
    };
  }, [key, opts, width, height]);

  return result;
}
