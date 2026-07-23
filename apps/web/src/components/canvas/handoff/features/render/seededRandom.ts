/**
 * Deterministic PRNG for presentation wobble — Math.random is banned.
 * Same seed string always yields the same sequence.
 */

/** FNV-1a 32-bit hash of a string. */
export function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 — returns [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** PRNG seeded from a stable item id (or any string key). */
export function seededRandom(id: string): () => number {
  return mulberry32(fnv1a32(id));
}

/**
 * Hand-wobbled circle path (viewBox-centred).
 * Amplitude is a fraction of radius (e.g. 0.025 = 2.5%).
 */
export function wobbledCirclePath(
  cx: number,
  cy: number,
  r: number,
  rand: () => number,
  opts?: { segments?: number; amplitude?: number },
): string {
  const n = opts?.segments ?? 24;
  const amp = (opts?.amplitude ?? 0.025) * r;
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wobble = (rand() * 2 - 1) * amp;
    const rr = r + wobble;
    pts.push({ x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) });
  }
  if (pts.length === 0) return "";
  let d = `M ${pts[0]!.x.toFixed(3)} ${pts[0]!.y.toFixed(3)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    const prev = pts[i - 1]!;
    const mx = (prev.x + p.x) / 2;
    const my = (prev.y + p.y) / 2;
    d += ` Q ${prev.x.toFixed(3)} ${prev.y.toFixed(3)} ${mx.toFixed(3)} ${my.toFixed(3)}`;
  }
  const last = pts[pts.length - 1]!;
  d += ` Q ${last.x.toFixed(3)} ${last.y.toFixed(3)} ${pts[0]!.x.toFixed(3)} ${pts[0]!.y.toFixed(3)} Z`;
  return d;
}

/** Quadratic leader control point with seeded wobble. */
export function wobbledLeaderControl(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rand: () => number,
): { cx: number; cy: number } {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bulge = (rand() * 2 - 1) * Math.min(8, len * 0.18);
  return { cx: mx + nx * bulge, cy: my + ny * bulge };
}
