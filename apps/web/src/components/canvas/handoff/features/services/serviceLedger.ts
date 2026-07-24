/**
 * Live Services ledger — site context + design construction rows.
 * Stable IDs from geometry fingerprints (site_frame has no per-feature ids yet).
 */

import type { ConstructionTrench, IrrigationZone } from "@workstream/contracts";
import type { SpotLevel, StudioItem } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";

export type ServiceLedgerSection = "site" | "design";

export type ServiceLedgerKind =
  | "corridor"
  | "easement"
  | "level"
  | "lighting"
  | "drip"
  | "trench"
  | "frenchdrain";

export type ServiceLedgerRow = {
  id: string;
  section: ServiceLedgerSection;
  kind: ServiceLedgerKind;
  label: string;
  /** Primary metric line — e.g. "12.4 m" or "RL 42.15". */
  metric: string;
  /** Secondary cue — source / depth / fixture count. */
  detail: string;
  glyph: string;
};

function hash32(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function fpPts(pts: Array<{ x: number; y: number }>): string {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(";");
}

export function corridorFeatureId(pts: PctPoint[]): string {
  return `corridor:${hash32(fpPts(pts))}`;
}

export function easementFeatureId(pts: PctPoint[]): string {
  return `easement:${hash32(fpPts(pts))}`;
}

export function levelFeatureId(lv: SpotLevel): string {
  return `level:${hash32(`${lv.x.toFixed(2)},${lv.y.toFixed(2)},${lv.z}`)}`;
}

function polylineLenM(pts: PctPoint[], scaleM: number): number {
  if (pts.length < 2 || scaleM <= 0) return 0;
  let sum = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const dx = ((b.x - a.x) / 100) * scaleM;
    const dy = ((b.y - a.y) / 100) * scaleM;
    sum += Math.hypot(dx, dy);
  }
  return sum;
}

function ringAreaM2(pts: PctPoint[], scaleM: number): number {
  if (pts.length < 3 || scaleM <= 0) return 0;
  const projected = pts.map((p) => ({
    x: (p.x / 100) * scaleM,
    y: (p.y / 100) * scaleM,
  }));
  let sum = 0;
  const n = projected.length;
  for (let i = 0; i < n; i++) {
    const a = projected[i]!;
    const b = projected[(i + 1) % n]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function fmtM(n: number): string {
  if (n < 10) return `${n.toFixed(1)} m`;
  return `${Math.round(n)} m`;
}

function fmtM2(n: number): string {
  if (n < 10) return `${n.toFixed(1)} m²`;
  return `${Math.round(n)} m²`;
}

export type BuildServiceLedgerInput = {
  services: PctPoint[][];
  easements: PctPoint[][];
  levels: SpotLevel[];
  irrigationZones: IrrigationZone[];
  constructionTrenches: ConstructionTrench[];
  items: StudioItem[];
  scaleM: number;
};

export function buildServiceLedgerRows(
  input: BuildServiceLedgerInput,
): ServiceLedgerRow[] {
  const rows: ServiceLedgerRow[] = [];
  const { scaleM } = input;

  input.services.forEach((ring, i) => {
    if (ring.length < 2) return;
    const lm = polylineLenM(ring, scaleM);
    rows.push({
      id: corridorFeatureId(ring),
      section: "site",
      kind: "corridor",
      label: `Service corridor ${i + 1}`,
      metric: fmtM(lm),
      detail: `${ring.length} pts · surveyed`,
      glyph: "〜",
    });
  });

  input.easements.forEach((ring, i) => {
    if (ring.length < 3) return;
    const area = ringAreaM2(ring, scaleM);
    rows.push({
      id: easementFeatureId(ring),
      section: "site",
      kind: "easement",
      label: `Easement ${i + 1}`,
      metric: fmtM2(area),
      detail: "Title / hatch · not BYDA asset",
      glyph: "▦",
    });
  });

  input.levels.forEach((lv, i) => {
    rows.push({
      id: levelFeatureId(lv),
      section: "site",
      kind: "level",
      label: `RL ${lv.z.toFixed(2)}`,
      metric: `RL ${lv.z.toFixed(2)} m`,
      detail: `Spot ${i + 1}`,
      glyph: "⊕",
    });
  });

  for (const z of input.irrigationZones) {
    const pts = z.points.map((p) => ({ x: p.x_pct, y: p.y_pct }));
    const lm = polylineLenM(pts, scaleM);
    const lighting = z.kind === "lighting";
    rows.push({
      id: `zone:${z.id}`,
      section: "design",
      kind: lighting ? "lighting" : "drip",
      label: z.name?.trim() || (lighting ? "Lighting run" : "Drip zone"),
      metric: fmtM(lm),
      detail: lighting
        ? `Lighting · ~${z.fixture_spacing_m ?? 2.5} m spacing`
        : "Drip irrigation",
      glyph: lighting ? "✦" : "≈",
    });
  }

  for (const t of input.constructionTrenches) {
    if (t.ghost) continue;
    const pts = t.points.map((p) => ({ x: p.x_pct, y: p.y_pct }));
    const lm = polylineLenM(pts, scaleM);
    rows.push({
      id: `trench:${t.id}`,
      section: "design",
      kind: "trench",
      label: t.name?.trim() || t.kind,
      metric: fmtM(lm),
      detail: `Trench · ${t.depth_mm ?? 300} mm · ${t.kind}`,
      glyph: "⎓",
    });
  }

  input.items
    .filter((i) => i.t === "frenchdrain" && !i.ghost)
    .forEach((i, n) => {
      rows.push({
        id: `item:${i.id}`,
        section: "design",
        kind: "frenchdrain",
        label: `French drain ${n + 1}`,
        metric: "symbol",
        detail: "Ag-pipe cue",
        glyph: "⊟",
      });
    });

  return rows;
}

/** Opacity for a service feature given hide + focus session prefs. */
export function resolveServiceFeatureVisual(
  id: string,
  hiddenIds: Record<string, boolean>,
  focusedIds: string[] | null,
): { opacity: number; hittable: boolean; hidden: boolean } {
  if (hiddenIds[id]) {
    return { opacity: 0, hittable: false, hidden: true };
  }
  if (focusedIds == null || focusedIds.length === 0) {
    return { opacity: 1, hittable: true, hidden: false };
  }
  if (focusedIds.includes(id)) {
    return { opacity: 1, hittable: true, hidden: false };
  }
  return { opacity: 0.12, hittable: false, hidden: false };
}
