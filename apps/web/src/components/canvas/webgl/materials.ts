/**
 * Phase M — 21-material palette + dash signatures (spec §7.1/§8c).
 *
 * The material palette is the single source of truth for every stroke
 * material in the WebGL studio. 21 named materials, grouped, no colour
 * wheel. Softscape stays hue-only; markup materials carry mandatory dash
 * signatures so they survive greyscale and colour-blind review.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase M.
 * Reference: design_handoff_landscape_canvas/.../README.md §7.1, code/tokens.ts
 */

export type MaterialGroup = "softscape" | "hardscape" | "soilWater" | "markup";

export interface MaterialEntry {
  id: string;
  label: string;
  group: MaterialGroup;
  /** OKLCH colour string (or hex for drafting). */
  color: string;
  /** Dash signature for semantic markup materials (8c). Undefined for
   *  softscape (hue-only, no dash). */
  dash?: number[];
  /** End glyph for dash signatures: 'bar' | 'glyph:G' | 'node' | 'cross' | 'arc' | 'none'. */
  dashEnds?: "bar" | "glyph:G" | "node" | "cross" | "arc" | "none";
  /** Stroke weight in mm at issued scale. */
  weightMm?: number;
  /** True for semantic markup materials (carry dash signatures). */
  semantic: boolean;
}

export const MATERIAL_GROUPS: { id: MaterialGroup; label: string }[] = [
  { id: "softscape", label: "Softscape" },
  { id: "hardscape", label: "Hardscape" },
  { id: "soilWater", label: "Soil / water" },
  { id: "markup", label: "Markup" },
];

/** The 21-material palette (spec §7.1). Order within each group is canonical. */
export const MATERIALS: MaterialEntry[] = [
  // Softscape — hue-only, no dash signatures
  { id: "moss", label: "Moss", group: "softscape", color: "oklch(0.48 0.11 145)", semantic: false },
  { id: "sage", label: "Sage", group: "softscape", color: "oklch(0.74 0.055 145)", semantic: false },
  { id: "olive", label: "Olive", group: "softscape", color: "oklch(0.55 0.09 110)", semantic: false },
  { id: "chartreuse", label: "Chartreuse", group: "softscape", color: "oklch(0.86 0.17 122)", semantic: false },
  { id: "fern", label: "Fern", group: "softscape", color: "oklch(0.38 0.09 155)", semantic: false },
  { id: "silver-foliage", label: "Silver foliage", group: "softscape", color: "oklch(0.80 0.02 150)", semantic: false },
  // Hardscape
  { id: "corten", label: "Corten", group: "hardscape", color: "oklch(0.50 0.14 45)", semantic: false },
  { id: "bluestone", label: "Bluestone", group: "hardscape", color: "oklch(0.48 0.03 250)", semantic: false },
  { id: "sandstone", label: "Sandstone", group: "hardscape", color: "oklch(0.79 0.06 82)", semantic: false },
  { id: "terracotta", label: "Terracotta", group: "hardscape", color: "oklch(0.60 0.13 35)", semantic: false },
  { id: "asphalt", label: "Asphalt", group: "hardscape", color: "oklch(0.33 0.012 260)", semantic: false },
  { id: "concrete", label: "Concrete", group: "hardscape", color: "oklch(0.68 0.012 250)", semantic: false },
  // Soil / water
  { id: "water", label: "Water", group: "soilWater", color: "oklch(0.72 0.13 215)", semantic: false },
  { id: "gravel", label: "Gravel", group: "soilWater", color: "oklch(0.66 0.02 90)", semantic: false },
  { id: "mulch", label: "Mulch", group: "soilWater", color: "oklch(0.42 0.06 60)", semantic: false },
  { id: "decomposed-granite", label: "Decomposed granite", group: "soilWater", color: "oklch(0.60 0.05 60)", semantic: false },
  // Markup — dash signatures mandatory (8c)
  { id: "setback", label: "Setback", group: "markup", color: "oklch(0.62 0.23 25)", semantic: true, dash: [26, 10], dashEnds: "bar", weightMm: 0.5 },
  { id: "gas", label: "Gas", group: "markup", color: "oklch(0.88 0.19 100)", semantic: true, dash: [18, 7, 3, 7], dashEnds: "glyph:G", weightMm: 0.35 },
  { id: "services", label: "Services", group: "markup", color: "oklch(0.60 0.20 320)", semantic: true, dash: [3, 8], dashEnds: "node", weightMm: 0.35 },
  { id: "survey", label: "Survey", group: "markup", color: "oklch(0.78 0.12 200)", semantic: true, dash: [7, 5], dashEnds: "cross", weightMm: 0.25 },
  { id: "drafting", label: "Drafting", group: "markup", color: "#f2f0ea", semantic: true, dash: [], dashEnds: "none", weightMm: 0.3 },
];

/** Lookup by id. */
export const materialById = (id: string): MaterialEntry | undefined =>
  MATERIALS.find((m) => m.id === id);

/** Materials in a group, in canonical order. */
export const materialsByGroup = (group: MaterialGroup): MaterialEntry[] =>
  MATERIALS.filter((m) => m.group === group);

/** Build-up ramp alpha steps (spec §7.1): the five layers the multiply nib produces. */
export const BUILD_UP_RAMP = [0.22, 0.42, 0.62, 0.82, 1.0] as const;

/**
 * Convert mm at issued scale to screen px. Weights are mm at issued scale;
 * convert only at render, never store px (spec §7.1).
 * Reference: code/tokens.ts mmToPx.
 */
export function mmToPx(mm: number, scaleDenominator: number, dpi = 96): number {
  return (mm / 25.4) * dpi * (200 / scaleDenominator);
}

/**
 * Phase M.4 — dash signature scales with stroke weight, not zoom.
 * The dash array is in screen px at the stroke's weight, independent of
 * the camera zoom. This returns the dash array in the same units as the
 * stroke width (screen px), so it stays constant across zoom levels.
 */
export function dashSignaturePx(
  material: MaterialEntry,
  strokeWeightPx: number,
): number[] {
  if (!material.dash || material.dash.length === 0) return [];
  // Scale the dash pattern proportionally to the stroke weight, not zoom.
  // The base weight is the material's weightMm; the dash scales with the
  // ratio of actual weight to base weight.
  const baseWeight = material.weightMm ?? 0.3;
  const scale = strokeWeightPx / mmToPx(baseWeight, 200);
  return material.dash.map((d) => d * scale);
}

/**
 * Phase M.5 — greyscale proof. Convert an OKLCH/hex colour to a luminance
 * value (0–1). The greyscale proof asserts every semantic line is still
 * distinguishable when rendered in greyscale.
 */
export function greyscaleLuminance(color: string): number {
  // Parse OKLCH: oklch(L C H) — L is the perceptual lightness (0–1).
  const oklchMatch = color.match(/oklch\(\s*([\d.]+)\s+/);
  if (oklchMatch) {
    return parseFloat(oklchMatch[1]);
  }
  // Parse hex: #RRGGBB — convert to relative luminance (sRGB).
  const hexMatch = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hexMatch) {
    const r = parseInt(hexMatch[1], 16) / 255;
    const g = parseInt(hexMatch[2], 16) / 255;
    const b = parseInt(hexMatch[3], 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return 0.5;
}

/**
 * Phase M.5 — assert every semantic markup material is distinguishable in
 * greyscale. Two materials are distinguishable if their luminance differs
 * by at least the threshold, OR they have different dash signatures.
 */
export const GREYSCALE_DISTINGUISH_THRESHOLD = 0.08;

export function isGreyscaleDistinguishable(
  a: MaterialEntry,
  b: MaterialEntry,
): boolean {
  if (a.dash && b.dash && a.dash.join(",") !== b.dash.join(",")) return true;
  if (a.dashEnds && b.dashEnds && a.dashEnds !== b.dashEnds) return true;
  return Math.abs(greyscaleLuminance(a.color) - greyscaleLuminance(b.color)) >= GREYSCALE_DISTINGUISH_THRESHOLD;
}
