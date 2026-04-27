"use client";

import { useEffect, useRef } from "react";
import createGlobe from "cobe";

type GlobeProps = {
  className?: string;
  rotationSpeed?: number;
};

// Markers: cities of interest. Lisbon is the HQ; others are the main client markets.
// [lat, lng] + relative size.
const LISBON: [number, number] = [38.7223, -9.1393];

// Marker sizes are roughly 30% of the previous values so the dots feel like
// quiet city pins instead of full beads.
const CITIES: Array<{ location: [number, number]; size: number }> = [
  { location: LISBON, size: 0.025 },                  // Lisbon (HQ)
  { location: [40.4168, -3.7038], size: 0.015 },      // Madrid
  { location: [51.5074, -0.1278], size: 0.017 },      // London
  { location: [48.8566, 2.3522], size: 0.015 },       // Paris
  { location: [52.52, 13.405], size: 0.013 },         // Berlin
  { location: [41.9028, 12.4964], size: 0.013 },      // Rome
  { location: [35.8997, 14.5147], size: 0.011 },      // Valletta (Malta)
  { location: [40.7128, -74.006], size: 0.019 },      // New York
  { location: [34.0522, -118.2437], size: 0.015 },    // Los Angeles
  { location: [25.7617, -80.1918], size: 0.015 },     // Miami
  { location: [41.8781, -87.6298], size: 0.013 },     // Chicago
  { location: [29.7604, -95.3698], size: 0.011 },     // Houston
  { location: [-23.5505, -46.6333], size: 0.017 },    // São Paulo
  { location: [-22.9068, -43.1729], size: 0.013 },    // Rio
  { location: [19.4326, -99.1332], size: 0.013 },     // Mexico City
  { location: [25.2048, 55.2708], size: 0.013 },      // Dubai
  { location: [1.3521, 103.8198], size: 0.011 },      // Singapore
  { location: [35.6762, 139.6503], size: 0.013 },     // Tokyo
  { location: [-33.8688, 151.2093], size: 0.011 },    // Sydney
];

// Arcs from Lisbon (HQ) out to the main markets. Visualizes global reach.
const ARCS: Array<{ from: [number, number]; to: [number, number] }> = [
  { from: LISBON, to: [40.7128, -74.006] },     // NYC
  { from: LISBON, to: [34.0522, -118.2437] },   // LA
  { from: LISBON, to: [25.7617, -80.1918] },    // Miami
  { from: LISBON, to: [-23.5505, -46.6333] },   // São Paulo
  { from: LISBON, to: [19.4326, -99.1332] },    // Mexico City
  { from: LISBON, to: [51.5074, -0.1278] },     // London
  { from: LISBON, to: [48.8566, 2.3522] },      // Paris
  { from: LISBON, to: [25.2048, 55.2708] },     // Dubai
  { from: LISBON, to: [35.6762, 139.6503] },    // Tokyo
  { from: LISBON, to: [-33.8688, 151.2093] },   // Sydney
];

export function Globe({ className, rotationSpeed = 0.0022 }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(3.6);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Mobile GPUs choke on the desktop sample density + 2x supersampling.
    // Keep the desktop look untouched and only soften the mobile path.
    const dprCap = isMobile ? 1.5 : 2;
    const bufferScale = isMobile ? 1 : 2;
    const mapSamples = isMobile ? 8000 : 18000;

    let width = 0;
    const onResize = () => {
      width = canvas.offsetWidth;
    };
    window.addEventListener("resize", onResize);
    onResize();

    const globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, dprCap),
      width: width * bufferScale,
      height: width * bufferScale,
      phi: phiRef.current,
      theta: 0.25,
      dark: 1,
      diffuse: 1.3,
      mapSamples,
      mapBrightness: 7,
      baseColor: [0.08, 0.16, 0.32],
      markerColor: [0.95, 0.73, 0.22],
      glowColor: [0.1, 0.18, 0.38],
      markers: CITIES,
      arcs: ARCS,
      arcColor: [0.95, 0.73, 0.22],
      arcWidth: 0.006,
      arcHeight: 0.32,
    });

    let rafId = 0;
    let visible = true;
    const animate = () => {
      if (!reducedMotion) {
        phiRef.current += rotationSpeed;
      }
      globe.update({
        phi: phiRef.current,
        width: width * bufferScale,
        height: width * bufferScale,
      });
      rafId = requestAnimationFrame(animate);
    };
    const start = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(animate);
    };
    const stop = () => {
      if (!rafId) return;
      cancelAnimationFrame(rafId);
      rafId = 0;
    };

    // Pause the RAF when the section scrolls out of view so the globe stops
    // burning frames in Why Us while the user is reading FAQ or Contact.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible = entry.isIntersecting;
          if (visible) start();
          else stop();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(canvas);

    if (visible) start();

    // Subtle fade-in on mount
    canvas.style.opacity = "0";
    requestAnimationFrame(() => {
      canvas.style.transition = "opacity 1.4s ease";
      canvas.style.opacity = "1";
    });

    return () => {
      stop();
      io.disconnect();
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, [rotationSpeed]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        aspectRatio: "1",
        contain: "layout paint style size",
      }}
      aria-hidden
    />
  );
}
