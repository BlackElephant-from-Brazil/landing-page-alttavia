"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `target` once the returned `ref` element
 * enters the viewport (IntersectionObserver, fires once, threshold 0.5).
 * Returns `{ count, ref }` — attach `ref` to any HTMLElement.
 */
export function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const triggered = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || triggered.current) return;
        triggered.current = true;

        const start = performance.now();
        function tick(now: number) {
          const elapsed = now - start;
          const t = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
          setCount(Math.round(eased * target));
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { count, ref };
}
