/**
 * Sketch dock cursors — pen is a graded fine tip → thick marker;
 * eraser is a rubber block, not a generic cell cursor.
 */

export type SketchTipGrade = "fine" | "medium" | "marker";

export const SKETCH_TIP_GRADES: readonly SketchTipGrade[] = [
  "fine",
  "medium",
  "marker",
] as const;

export const SKETCH_TIP_LABEL: Record<SketchTipGrade, string> = {
  fine: "Fine",
  medium: "Medium",
  marker: "Marker",
};

/** Hotspot at the tip (bottom-left of the nib). */
const PEN_HOTSPOT = { x: 4, y: 28 } as const;
const ERASER_HOTSPOT = { x: 8, y: 26 } as const;

/** Stroke width band: light pressure → fine tip; firm → thick marker. */
export const SKETCH_TIP_BAND: Record<
  SketchTipGrade,
  { min: number; max: number }
> = {
  fine: { min: 1.05, max: 2.25 },
  medium: { min: 1.7, max: 3.6 },
  marker: { min: 2.85, max: 5.5 },
};

function tipNibRadius(tip: SketchTipGrade): number {
  if (tip === "fine") return 1.15;
  if (tip === "marker") return 3.4;
  return 2.1;
}

/** CSS cursor — angled felt marker; nib size follows tip grade. */
export function sketchPenCursor(tip: SketchTipGrade = "medium"): string {
  const r = tipNibRadius(tip);
  const bodyW = tip === "marker" ? 7.5 : tip === "fine" ? 4.2 : 5.6;
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
      `<g transform="rotate(-35 16 16)">` +
      `<rect x="${16 - bodyW / 2}" y="4" width="${bodyW}" height="18" rx="1.4" ` +
      `fill="#241318" fill-opacity="0.92"/>` +
      `<rect x="${16 - bodyW / 2 + 0.7}" y="5" width="${Math.max(1.5, bodyW - 1.4)}" height="5" rx="0.8" ` +
      `fill="#C2455F" fill-opacity="0.85"/>` +
      `<path d="M${16 - r * 0.9} 22 L16 ${22 + r * 2.2} L${16 + r * 0.9} 22 Z" ` +
      `fill="#1C1917"/>` +
      `<circle cx="16" cy="${22 + r * 2.05}" r="${Math.max(0.7, r * 0.55)}" fill="#1C1917"/>` +
      `</g></svg>`,
  );
  return `url("data:image/svg+xml,${svg}") ${PEN_HOTSPOT.x} ${PEN_HOTSPOT.y}, crosshair`;
}

/** CSS cursor — pink rubber eraser tip. */
export function sketchEraserCursor(): string {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
      `<g transform="rotate(-28 14 22)">` +
      `<rect x="6" y="14" width="14" height="10" rx="2.2" ` +
      `fill="#FFD3DE" stroke="#C2455F" stroke-width="1.1"/>` +
      `<rect x="6" y="14" width="14" height="3.2" rx="1.2" fill="#F6EAED"/>` +
      `<path d="M8 24h10" stroke="#B08A95" stroke-width="1" stroke-linecap="round"/>` +
      `</g>` +
      `<circle cx="8" cy="26" r="1.4" fill="#7A5560" fill-opacity="0.45"/>` +
      `</svg>`,
  );
  return `url("data:image/svg+xml,${svg}") ${ERASER_HOTSPOT.x} ${ERASER_HOTSPOT.y}, cell`;
}
