import type { CadDocument, CadEntity } from "@workstream/contracts";

export type CadQtyUnit = "m2" | "lm" | "ea";

export type CadQuantityRow = {
  id: string;
  entity_id: string;
  layer: string;
  kind: CadEntity["kind"];
  label: string;
  qty: number;
  unit: CadQtyUnit;
  /** Centroid in document metres for overlay chips. */
  anchor: { x: number; y: number };
  ghost: boolean;
};

export type CadQuantitySurvey = {
  project_id: string;
  committed_only: boolean;
  rows: CadQuantityRow[];
  totals: {
    hardscape_m2: number;
    planting_ea: number;
    irrigation_lm: number;
    structure_m2: number;
    other_m2: number;
    other_lm: number;
    other_ea: number;
  };
};

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

function polylineLength(
  points: { x: number; y: number }[],
  closed: boolean,
): number {
  if (points.length < 2) return 0;
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += dist(points[i - 1]!, points[i]!);
  }
  if (closed) len += dist(points[points.length - 1]!, points[0]!);
  return len;
}

/** Shoelace area for closed polyline (m²). */
function polygonArea(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function centroid(points: { x: number; y: number }[]): {
  x: number;
  y: number;
} {
  if (points.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

function measureEntity(e: CadEntity): {
  qty: number;
  unit: CadQtyUnit;
  anchor: { x: number; y: number };
  label: string;
} {
  switch (e.kind) {
    case "line": {
      const qty = Math.round(dist(e.start, e.end) * 100) / 100;
      return {
        qty,
        unit: "lm",
        anchor: {
          x: (e.start.x + e.end.x) / 2,
          y: (e.start.y + e.end.y) / 2,
        },
        label: `${e.layer} line`,
      };
    }
    case "polyline": {
      if (e.closed) {
        const qty = Math.round(polygonArea(e.points) * 100) / 100;
        return {
          qty,
          unit: "m2",
          anchor: centroid(e.points),
          label: `${e.layer} area`,
        };
      }
      const qty =
        Math.round(polylineLength(e.points, false) * 100) / 100;
      return {
        qty,
        unit: "lm",
        anchor: centroid(e.points),
        label: `${e.layer} path`,
      };
    }
    case "circle": {
      const qty = Math.round(Math.PI * e.radius * e.radius * 100) / 100;
      return {
        qty,
        unit: "m2",
        anchor: { ...e.center },
        label: `${e.layer} circle`,
      };
    }
    case "arc": {
      const sweep = Math.abs(e.end_angle_deg - e.start_angle_deg);
      const rad = (sweep * Math.PI) / 180;
      const qty = Math.round(e.radius * rad * 100) / 100;
      return {
        qty,
        unit: "lm",
        anchor: { ...e.center },
        label: `${e.layer} arc`,
      };
    }
    case "insert":
      return {
        qty: 1,
        unit: "ea",
        anchor: { ...e.position },
        label: e.block_name,
      };
    case "dimension": {
      const qty = Math.round(dist(e.p1, e.p2) * 100) / 100;
      return {
        qty,
        unit: "lm",
        anchor: {
          x: (e.p1.x + e.p2.x) / 2,
          y: (e.p1.y + e.p2.y) / 2,
        },
        label: "dimension",
      };
    }
    case "text":
      return {
        qty: 1,
        unit: "ea",
        anchor: { ...e.position },
        label: e.value.slice(0, 40) || "note",
      };
    default:
      return { qty: 0, unit: "ea", anchor: { x: 0, y: 0 }, label: "unknown" };
  }
}

function bucketFor(
  layer: string,
  unit: CadQtyUnit,
): keyof CadQuantitySurvey["totals"] {
  const L = layer.toUpperCase();
  if (L.includes("HARD") || L.includes("PAV") || L.includes("LAWN")) {
    return unit === "m2" ? "hardscape_m2" : unit === "lm" ? "other_lm" : "other_ea";
  }
  if (L.includes("PLANT") || L.includes("TREE") || L.includes("SKETCH")) {
    return unit === "ea" ? "planting_ea" : unit === "m2" ? "other_m2" : "other_lm";
  }
  if (L.includes("IRRIG") || L.includes("WATER")) {
    return unit === "lm" ? "irrigation_lm" : unit === "m2" ? "other_m2" : "other_ea";
  }
  if (L.includes("STRUCT") || L.includes("RETAIN") || L.includes("FENCE")) {
    return unit === "m2" ? "structure_m2" : unit === "lm" ? "other_lm" : "other_ea";
  }
  if (unit === "m2") return "other_m2";
  if (unit === "lm") return "other_lm";
  return "other_ea";
}

/** One-click quantity survey from CadDocument geometry (metres). */
export function cadQuantitySurvey(
  doc: CadDocument,
  opts?: { committedOnly?: boolean },
): CadQuantitySurvey {
  const committedOnly = opts?.committedOnly !== false;
  const rows: CadQuantityRow[] = [];
  const totals: CadQuantitySurvey["totals"] = {
    hardscape_m2: 0,
    planting_ea: 0,
    irrigation_lm: 0,
    structure_m2: 0,
    other_m2: 0,
    other_lm: 0,
    other_ea: 0,
  };

  for (const e of doc.entities) {
    if (committedOnly && e.ghost) continue;
    if (e.kind === "text" || e.kind === "dimension") continue;
    const m = measureEntity(e);
    if (m.qty <= 0) continue;
    rows.push({
      id: `qs-${e.id}`,
      entity_id: e.id,
      layer: e.layer,
      kind: e.kind,
      label: m.label,
      qty: m.qty,
      unit: m.unit,
      anchor: m.anchor,
      ghost: e.ghost,
    });
    const key = bucketFor(e.layer, m.unit);
    totals[key] = Math.round((totals[key] + m.qty) * 100) / 100;
  }

  return {
    project_id: doc.project_id,
    committed_only: committedOnly,
    rows,
    totals,
  };
}
