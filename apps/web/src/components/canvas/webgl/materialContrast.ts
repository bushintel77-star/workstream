/**
 * Tier-1 palette widget — contrast honesty for the active swatch.
 *
 * The palette surfaces the WCAG 2.x contrast ratio between the armed
 * material and the live canvas ground, so "will this line read?" is a
 * number on the swatch, not a guess. Pure math — every renderer-free
 * claim here is unit-tested.
 *
 * Pipeline per colour string:
 *   oklch(L C H) → OKLab → LMS → linear sRGB → relative luminance Y
 *   #rrggbb      → linear sRGB (sRGB EOTF)  → relative luminance Y
 *   ratio = (Ylight + 0.05) / (Ydark + 0.05)
 *
 * The materials palette authors colours in OKLCH (materials.ts), so the
 * OKLCH path is the one that matters; the hex path exists for drafting
 * (#f2f0ea) and for reading the canvas ground token out of the DOM.
 */

/** sRGB channel → linear light (the EOTF inverse, per WCAG 2.x). */
function srgbChannelToLinear(channel8bit: number): number {
  const c = channel8bit / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** OKLab → linear sRGB (Björn Ottosson's reference matrices). */
function oklabToLinearSrgb(
  L: number,
  a: number,
  b: number,
): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/**
 * Relative luminance (WCAG 2.x) of a colour authored as `oklch(L C H)` or
 * `#rrggbb`. Unparseable input returns 0.5 — a neutral mid-grey that keeps
 * the readout finite rather than lying with a confident wrong number.
 */
export function relativeLuminance(color: string): number {
  const oklch = color.match(
    /oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)/,
  );
  if (oklch) {
    const L = parseFloat(oklch[1]!);
    const C = parseFloat(oklch[2]!);
    const Hdeg = parseFloat(oklch[3]!);
    const h = (Hdeg * Math.PI) / 180;
    const [r, g, b] = oklabToLinearSrgb(L, C * Math.cos(h), C * Math.sin(h));
    return (
      0.2126 * Math.max(0, r) + 0.7152 * Math.max(0, g) + 0.0722 * Math.max(0, b)
    );
  }
  const hex = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) {
    return (
      0.2126 * srgbChannelToLinear(parseInt(hex[1], 16)) +
      0.7152 * srgbChannelToLinear(parseInt(hex[2], 16)) +
      0.0722 * srgbChannelToLinear(parseInt(hex[3], 16))
    );
  }
  return 0.5;
}

/**
 * WCAG 2.x contrast ratio between two colours, rounded to 1 decimal place
 * (the readout shows "4.8:1", not 4.8123…). Same colour → 1.
 */
export function contrastRatio(a: string, b: string): number {
  const ya = relativeLuminance(a);
  const yb = relativeLuminance(b);
  const lighter = Math.max(ya, yb);
  const darker = Math.min(ya, yb);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 10) / 10;
}

/**
 * The canvas ground the studio inks onto, read from the live `--ws-canvas`
 * token (tokens.css is the theme's source of truth — a re-theme updates
 * the readout without touching this module). Falls back to the current
 * token value when the sheet is unreachable (tests, SSR).
 */
export const CANVAS_GROUND_FALLBACK = "#0d0f11";

export function canvasGroundColor(doc?: {
  getPropertyValue(name: string): string;
}): string {
  const value = doc?.getPropertyValue("--ws-canvas").trim();
  return value || CANVAS_GROUND_FALLBACK;
}

/** The readout string for the active swatch: "4.8:1". */
export function contrastReadout(materialColor: string, canvasColor: string): string {
  return `${contrastRatio(materialColor, canvasColor)}:1`;
}
