"use client";

export function HeroBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Blob 1 — large, top-right, 18s orbit */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: 600,
          height: 600,
          top: "-15%",
          right: "-10%",
          background:
            "radial-gradient(circle at center, rgba(224,207,159,0.55) 0%, rgba(208,161,43,0.35) 40%, transparent 70%)",
          mixBlendMode: "multiply",
          animation: "blob-orbit-1 18s ease-in-out infinite",
          willChange: "transform",
        }}
      />
      {/* Blob 2 — medium, bottom-left, 14s orbit reversed */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: 400,
          height: 400,
          bottom: "-5%",
          left: "-8%",
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.50) 0%, rgba(230,185,74,0.25) 40%, transparent 70%)",
          mixBlendMode: "multiply",
          animation: "blob-orbit-2 14s ease-in-out infinite reverse",
          willChange: "transform",
        }}
      />
      {/* Blob 3 — small, center-right, 22s orbit with delay */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: 280,
          height: 280,
          top: "30%",
          right: "15%",
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.30) 0%, transparent 70%)",
          mixBlendMode: "multiply",
          animation: "blob-orbit-3 22s ease-in-out infinite",
          animationDelay: "-7s",
          willChange: "transform",
        }}
      />
    </div>
  );
}
