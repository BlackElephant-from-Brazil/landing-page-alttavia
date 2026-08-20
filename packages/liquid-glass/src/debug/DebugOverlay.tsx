"use client";

import type { MapGenResult } from "../gl/generate-map";

type Props = {
  maps: MapGenResult;
  filterId: string;
  width: number;
  height: number;
};

/**
 * Dev overlay activated by <LiquidGlass debug>.
 * Shows displacement map and filter metadata in a floating panel.
 */
export function DebugOverlay({ maps, filterId, width, height }: Props) {
  return (
    <div
      className="absolute inset-0 z-50 pointer-events-none flex flex-col gap-2 p-2"
      style={{ fontSize: 10, fontFamily: "monospace" }}
    >
      {/* Displacement map preview */}
      <div className="flex gap-2 items-start">
        <div>
          <div className="text-yellow-300 mb-1">displacement map</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={maps.displacementUrl}
            alt="displacement map"
            width={Math.min(width / 2, 120)}
            height={Math.min(height / 2, 60)}
            style={{ imageRendering: "pixelated", border: "1px solid rgba(255,255,0,0.3)" }}
          />
        </div>
        <div>
          <div className="text-yellow-300 mb-1">specular map</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={maps.specularUrl}
            alt="specular map"
            width={Math.min(width / 2, 120)}
            height={Math.min(height / 2, 60)}
            style={{ imageRendering: "pixelated", border: "1px solid rgba(255,255,0,0.3)" }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="text-yellow-300/80 leading-relaxed bg-black/50 px-2 py-1 rounded w-fit">
        <div>filter: #{filterId}</div>
        <div>size: {width}x{height}px</div>
        <div>maxDisp: {maps.maxDisplacement}px</div>
      </div>
    </div>
  );
}
