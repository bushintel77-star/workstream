import type {
  CadDocument,
  CadEntity,
  CatalogSymbol,
  DesignCanvas,
  SpatialLayer,
  SpatialObject,
  Survey,
} from "@workstream/contracts";
import { DEFAULT_PAVING_ASSEMBLY, totalDepthM } from "./assembly-recipe";
import { getCatalogSymbol } from "./catalog";

const DEFAULT_PAVING_DEPTH_M = totalDepthM(DEFAULT_PAVING_ASSEMBLY);

function layerForCategory(
  category: CatalogSymbol["category"] | undefined,
  symbolId: string,
): SpatialLayer {
  if (symbolId.includes("light") || symbolId.includes("lighting")) {
    return "lighting";
  }
  if (symbolId.includes("drain") || symbolId.includes("grade")) {
    return "topography";
  }
  switch (category) {
    case "paving":
      return "hardscape";
    case "planting":
      return "softscape";
    case "structure":
      return "structure";
    case "water":
      return "irrigation";
    case "furniture":
      return "other";
    default:
      return "other";
  }
}

function placementAreaM2(
  sym: CatalogSymbol | undefined,
  survey: Pick<Survey, "garden_area_m2"> | null | undefined,
  pinCount: number,
): number {
  if (!sym || pinCount <= 0) return 0;
  if (sym.id === "lawn-turf" && survey) {
    return Math.round(survey.garden_area_m2);
  }
  if (sym.category === "paving" && sym.default_width_m) {
    const w = sym.default_width_m;
    return Math.round(pinCount * w * w * 100) / 100;
  }
  if (sym.default_width_m) {
    const r = (sym.default_width_m * Math.max(pinCount, 1)) / 2;
    return Math.round(Math.PI * r * r * 100) / 100;
  }
  return 0;
}

function rootRadiusM(sym: CatalogSymbol | undefined): number | undefined {
  if (!sym || sym.category !== "planting") return undefined;
  const canopy = sym.mature_height_m
    ? Math.max(2, sym.mature_height_m * 0.45)
    : sym.default_width_m
      ? sym.default_width_m * 1.5
      : 3;
  return Math.round(canopy * 100) / 100;
}

function wallHeightM(sym: CatalogSymbol | undefined): number | undefined {
  if (!sym) return undefined;
  if (
    sym.id.includes("retaining") ||
    sym.label.toLowerCase().includes("retaining")
  ) {
    return sym.mature_height_m ?? 1.4;
  }
  return undefined;
}

/** Normalize design-studio placements into scaled spatial objects. */
export function spatialFactsFromCanvas(
  canvas: DesignCanvas | null | undefined,
  symbols: CatalogSymbol[],
  survey?: Pick<Survey, "garden_area_m2"> | null,
): SpatialObject[] {
  if (!canvas) return [];
  const symbolMap = new Map(symbols.map((s) => [s.id, s]));
  const out: SpatialObject[] = [];

  for (const p of canvas.placements) {
    const sym = symbolMap.get(p.symbol_id) ?? getCatalogSymbol(p.symbol_id);
    const layer = layerForCategory(sym?.category, p.symbol_id);
    const area = placementAreaM2(sym, survey, 1);
    const root = rootRadiusM(sym);
    const height = wallHeightM(sym);
    out.push({
      id: `placement:${p.id}`,
      layer,
      label: p.label ?? sym?.label ?? p.symbol_id,
      symbol_id: p.symbol_id,
      source: "placement",
      area_m2: area,
      length_m:
        layer === "hardscape" && area > 0
          ? Math.round(Math.sqrt(area) * 4 * 100) / 100
          : 0,
      depth_m: layer === "hardscape" ? DEFAULT_PAVING_DEPTH_M : undefined,
      height_m: height,
      volume_m3:
        layer === "hardscape" && area > 0
          ? Math.round(area * DEFAULT_PAVING_DEPTH_M * 100) / 100
          : undefined,
      count: 1,
      x_pct: p.x_pct,
      y_pct: p.y_pct,
      mature_canopy_m: root,
      root_radius_m: root,
    });
  }

  for (const zone of canvas.irrigation_zones ?? []) {
    const pts = zone.points;
    let length = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      // % of a ~30 m garden edge as rough scale when survey metres unknown
      length += Math.hypot(b.x_pct - a.x_pct, b.y_pct - a.y_pct) * 0.3;
    }
    out.push({
      id: `irrigation:${zone.id}`,
      layer: "irrigation",
      label: zone.name || "Irrigation zone",
      source: "irrigation",
      area_m2: 0,
      length_m: Math.round(length * 100) / 100,
      count: 1,
      x_pct: pts[0]?.x_pct,
      y_pct: pts[0]?.y_pct,
    });
  }

  for (const feature of canvas.features ?? []) {
    const pts = feature.geometry.points.map((v) => v.pct);
    let length = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      length += Math.hypot(b.x_pct - a.x_pct, b.y_pct - a.y_pct) * 0.3;
    }
    let area = 0;
    if (feature.geometry.type === "Polygon" && pts.length >= 3) {
      let sum = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % pts.length]!;
        sum += a.x_pct * b.y_pct - b.x_pct * a.y_pct;
      }
      // %² → indicative m² (0.3 m per %)
      area = Math.abs(sum) / 2 * 0.09;
    }
    const layer: SpatialLayer =
      feature.metadata.layer === "softscape_beds"
        ? "softscape"
        : feature.metadata.layer === "structure"
          ? "structure"
          : feature.metadata.layer === "irrigation"
            ? "irrigation"
            : "hardscape";
    const depth = feature.material_fill?.depth_m;
    const mid = pts[Math.floor(pts.length / 2)] ?? pts[0];
    out.push({
      id: `feature:${feature.id}`,
      layer,
      label: feature.metadata.friendly_name ?? "Landscape feature",
      symbol_id: feature.material_fill?.sku,
      source: "placement",
      area_m2: Math.round(area * 100) / 100,
      length_m: Math.round(length * 100) / 100,
      depth_m: depth,
      height_m:
        feature.metadata.friendly_name?.toLowerCase().includes("wall")
          ? 0.9
          : undefined,
      volume_m3:
        area > 0 && depth
          ? Math.round(area * depth * 100) / 100
          : undefined,
      count: 1,
      x_pct: mid?.x_pct,
      y_pct: mid?.y_pct,
    });
  }

  return out;
}

function polylineArea(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function polylineLength(
  points: { x: number; y: number }[],
  closed: boolean,
): number {
  if (points.length < 2) return 0;
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(
      points[i]!.x - points[i - 1]!.x,
      points[i]!.y - points[i - 1]!.y,
    );
  }
  if (closed) {
    len += Math.hypot(
      points[0]!.x - points[points.length - 1]!.x,
      points[0]!.y - points[points.length - 1]!.y,
    );
  }
  return len;
}

function layerFromCad(entity: CadEntity): SpatialLayer {
  const layer = entity.layer.toLowerCase();
  if (layer.includes("plant") || layer.includes("soft")) return "softscape";
  if (layer.includes("irrig") || layer.includes("water")) return "irrigation";
  if (layer.includes("light")) return "lighting";
  if (layer.includes("grade") || layer.includes("drain")) return "topography";
  if (layer.includes("struct") || layer.includes("wall")) return "structure";
  if (layer.includes("hard") || layer.includes("pav")) return "hardscape";
  return "hardscape";
}

/** Normalize committed CAD entities into spatial objects (ghosts skipped). */
export function spatialFactsFromCad(
  doc: CadDocument | null | undefined,
): SpatialObject[] {
  if (!doc) return [];
  const out: SpatialObject[] = [];
  for (const e of doc.entities) {
    if (e.ghost) continue;
    const layer = layerFromCad(e);
    let area = 0;
    let length = 0;
    let x_pct: number | undefined;
    let y_pct: number | undefined;
    if (e.kind === "polyline") {
      length = polylineLength(e.points, e.closed);
      if (e.closed) area = polylineArea(e.points);
      const cx =
        e.points.reduce((s, p) => s + p.x, 0) / Math.max(e.points.length, 1);
      const cy =
        e.points.reduce((s, p) => s + p.y, 0) / Math.max(e.points.length, 1);
      x_pct = (cx / doc.width_m) * 100;
      y_pct = (1 - cy / doc.height_m) * 100;
    } else if (e.kind === "circle") {
      area = Math.PI * e.radius * e.radius;
      length = 2 * Math.PI * e.radius;
      x_pct = (e.center.x / doc.width_m) * 100;
      y_pct = (1 - e.center.y / doc.height_m) * 100;
    } else if (e.kind === "line") {
      length = Math.hypot(e.end.x - e.start.x, e.end.y - e.start.y);
      x_pct = (((e.start.x + e.end.x) / 2) / doc.width_m) * 100;
      y_pct = (1 - (e.start.y + e.end.y) / 2 / doc.height_m) * 100;
    } else if (e.kind === "insert") {
      area = 1;
      x_pct = (e.position.x / doc.width_m) * 100;
      y_pct = (1 - e.position.y / doc.height_m) * 100;
    }
    out.push({
      id: `cad:${e.id}`,
      layer,
      label: `${e.kind} / ${e.layer}`,
      source: "cad",
      area_m2: Math.round(area * 100) / 100,
      length_m: Math.round(length * 100) / 100,
      depth_m: layer === "hardscape" ? DEFAULT_PAVING_DEPTH_M : undefined,
      volume_m3:
        layer === "hardscape" && area > 0
          ? Math.round(area * DEFAULT_PAVING_DEPTH_M * 100) / 100
          : undefined,
      count: 1,
      x_pct,
      y_pct,
    });
  }
  return out;
}

export function mergeSpatialFacts(
  canvasFacts: SpatialObject[],
  cadFacts: SpatialObject[],
): SpatialObject[] {
  // Prefer CAD when present for hardscape quantities; keep softscape pins.
  if (cadFacts.length === 0) return canvasFacts;
  const soft = canvasFacts.filter(
    (f) => f.layer === "softscape" || f.layer === "irrigation",
  );
  return [...cadFacts, ...soft];
}

/** Stable fingerprint for invalidate/preempt. */
export function spatialFingerprint(facts: SpatialObject[]): string {
  const parts = facts
    .map(
      (f) =>
        `${f.id}:${f.layer}:${f.area_m2}:${f.length_m}:${f.height_m ?? 0}:${f.count}`,
    )
    .sort();
  let h = 0;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `sf_${(h >>> 0).toString(16)}`;
}
