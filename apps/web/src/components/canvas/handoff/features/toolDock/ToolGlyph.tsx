"use client";

import type { ToolChipId } from "./toolChips";

/**
 * Crisp monochrome line icons for the frame tool rails — one shared 20×20
 * grid, 1.5px stroke, `currentColor`, round joins. This is the IDE-titlebar
 * icon language from the gallery-frame spec; it replaces the emoji glyphs so
 * the rail reads as a designed activity bar, not a text row.
 */
const P = {
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
};

const PATHS: Record<string, React.ReactNode> = {
  // Pen nib tracing a path.
  trace: (
    <>
      <path d="M3 17c3.5 0 4.5-2.2 6.5-6.5" {...P} />
      <path d="M9.2 10.6 13 6.8l3.2 3.2-3.8 3.8-3.2-3.2Z" {...P} />
      <path d="M13 6.8 14.4 5a1.4 1.4 0 0 1 2 0l1.2 1.2a1.4 1.4 0 0 1 0 2L16 10" {...P} />
    </>
  ),
  // Selection arrow.
  select: (
    <>
      <path d="M5 3.5 15 9l-4.2 1.3L9 15 5 3.5Z" {...P} />
    </>
  ),
  // Plus in a soft square — place from inventory.
  add: (
    <>
      <path d="M10 5.5v9M5.5 10h9" {...P} />
    </>
  ),
  // Paint bucket pouring fill.
  paint: (
    <>
      <path d="M8 3 14 9a1.1 1.1 0 0 1 0 1.6l-3.6 3.6a1.5 1.5 0 0 1-2.1 0L3.6 9.5a1.1 1.1 0 0 1 0-1.6L8 3Z" {...P} />
      <path d="M8 3 6.5 1.5" {...P} />
      <path d="M16 11.5c0 1-1 1.9-1 1.9s-1-.9-1-1.9a1 1 0 0 1 2 0Z" {...P} />
    </>
  ),
  // Drip / lighting path — a flowing centreline over a dashed run.
  zone: (
    <>
      <path d="M2.5 8c1.7-3 3.3-3 5 0s3.3 3 5 0" {...P} />
      <path d="M2.5 13h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="0.5 3" />
    </>
  ),
  // Ruler on the diagonal.
  measure: (
    <>
      <path d="M3.2 11.6 11.6 3.2l3.2 3.2-8.4 8.4-3.2-3.2Z" {...P} />
      <path d="M6 8.8l1.4 1.4M8.4 6.4l1.4 1.4M10.8 4l1.1 1.1" {...P} />
    </>
  ),
  // Padlock.
  lock: (
    <>
      <rect x="4.5" y="8" width="9" height="7" rx="1.4" {...P} />
      <path d="M6.6 8V6.4a2.4 2.4 0 0 1 4.8 0V8" {...P} />
    </>
  ),
  // Drafting grid.
  grid: (
    <>
      <rect x="3.5" y="3.5" width="11" height="11" rx="1.2" {...P} />
      <path d="M7.2 3.5v11M10.8 3.5v11M3.5 7.2h11M3.5 10.8h11" stroke="currentColor" strokeWidth="1" />
    </>
  ),
  // Calibrate — crosshair target.
  calib: (
    <>
      <circle cx="9" cy="9" r="4.2" {...P} />
      <path d="M9 1.8v2.4M9 13.8v2.4M1.8 9h2.4M13.8 9h2.4" {...P} />
    </>
  ),
  // Spot level — survey triangle over a base.
  level: (
    <>
      <path d="M9 4 14.5 14h-11L9 4Z" {...P} />
      <path d="M9 9.2v3" {...P} />
    </>
  ),
  // Service run — utility conduit.
  service: (
    <>
      <path d="M2.5 8c2-2.6 3.6-2.6 5.5 0s3.5 2.6 5.5 0" {...P} />
      <circle cx="4" cy="12.4" r="1" {...P} />
      <circle cx="14" cy="12.4" r="1" {...P} />
      <path d="M5 12.4h8" stroke="currentColor" strokeWidth="1" strokeDasharray="0.5 2.5" strokeLinecap="round" />
    </>
  ),
};

export function ToolGlyph({
  id,
  className,
  size = 18,
}: {
  id: ToolChipId;
  className?: string;
  size?: number;
}) {
  const path = PATHS[id] ?? PATHS.select;
  return (
    <svg
      className={className}
      viewBox="0 0 18 18"
      width={size}
      height={size}
      aria-hidden
      focusable={false}
    >
      {path}
    </svg>
  );
}
