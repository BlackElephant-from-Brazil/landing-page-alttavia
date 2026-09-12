"use client";

import { useEffect, useRef } from "react";

/**
 * A small confetti burst inside a progress card, for an order completed in
 * the last seven days. Fifty odd pieces in the brand's navy, gold and wheat
 * fall from the top of the card for about two and a half seconds, once per
 * page load, and the layer is gone afterwards.
 *
 * Drawn on a canvas that fills the card behind its content
 * (`absolute inset-0`, parent must be `relative overflow-hidden`), so
 * nothing in the layout moves and no keyframes need to live in the global
 * stylesheet. `aria-hidden` throughout: it says nothing the badge next to it
 * does not. Under `prefers-reduced-motion: reduce` the effect never starts.
 */

const DURATION_MS = 2500;
const MIN_PIECES = 40;
const MAX_PIECES = 60;
const COLORS = ["#0E2A47", "#D0A12B", "#E0CF9F", "#E6B94A", "#2D4B72"] as const;

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rotation: number;
  spin: number;
  color: string;
  delay: number;
};

function makePieces(width: number): Piece[] {
  const count = MIN_PIECES + Math.floor(Math.random() * (MAX_PIECES - MIN_PIECES + 1));
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i++) {
    pieces.push({
      x: width * (0.15 + Math.random() * 0.7),
      y: -12,
      vx: (Math.random() - 0.5) * 220,
      vy: -60 - Math.random() * 180,
      w: 5 + Math.random() * 5,
      h: 3 + Math.random() * 5,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 12,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 350,
    });
  }
  return pieces;
}

export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      canvas.hidden = true;
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) return;

    const scale = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.scale(scale, scale);

    const pieces = makePieces(width);
    const gravity = 420;
    let frame = 0;
    let start: number | null = null;
    let last = 0;

    const draw = (time: number) => {
      if (start === null) {
        start = time;
        last = time;
      }
      const elapsed = time - start;
      const dt = Math.min(0.05, (time - last) / 1000);
      last = time;
      context.clearRect(0, 0, width, height);
      const fade = elapsed > DURATION_MS - 500 ? Math.max(0, (DURATION_MS - elapsed) / 500) : 1;

      for (const piece of pieces) {
        if (elapsed < piece.delay) continue;
        piece.vy += gravity * dt;
        piece.vx *= 0.985;
        piece.x += piece.vx * dt;
        piece.y += piece.vy * dt;
        piece.rotation += piece.spin * dt;
        if (piece.y > height + 20) continue;
        context.save();
        context.globalAlpha = fade;
        context.translate(piece.x, piece.y);
        context.rotate(piece.rotation);
        context.fillStyle = piece.color;
        context.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
        context.restore();
      }

      if (elapsed < DURATION_MS) {
        frame = window.requestAnimationFrame(draw);
      } else {
        context.clearRect(0, 0, width, height);
        canvas.hidden = true;
      }
    };
    frame = window.requestAnimationFrame(draw);

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 size-full" />;
}
