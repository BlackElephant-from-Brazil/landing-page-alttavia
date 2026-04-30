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
