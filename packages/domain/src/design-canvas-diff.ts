import type { DesignCanvas } from "@workstream/contracts";

export type CanvasEntityKind =
  | "placement"
  | "stroke"
  | "irrigation_zone"
  | "construction_trench"
  | "annotation"
  | "image_layer"
  | "feature";

export type CanvasDiffChange = {
  kind: CanvasEntityKind;
  id: string;
  op: "added" | "removed" | "changed";
  label: string;
};

export type DesignCanvasDiff = {
  changes: CanvasDiffChange[];
  added: number;
  removed: number;
  changed: number;
};

function placementLabel(p: { label?: string | null; symbol_id: string }): string {
  return (p.label && p.label.trim()) || p.symbol_id;
}

function near(
  a: { x_pct?: number; y_pct?: number; x?: number; y?: number },
  b: { x_pct?: number; y_pct?: number; x?: number; y?: number },
  eps = 0.5,
): boolean {
  const ax = a.x_pct ?? a.x ?? 0;
  const ay = a.y_pct ?? a.y ?? 0;
  const bx = b.x_pct ?? b.x ?? 0;
  const by = b.y_pct ?? b.y ?? 0;
  return Math.abs(ax - bx) <= eps && Math.abs(ay - by) <= eps;
}

function diffById<T extends { id: string }>(
  kind: CanvasEntityKind,
  base: T[],
  other: T[],
  labelOf: (row: T) => string,
  equal: (a: T, b: T) => boolean,
): CanvasDiffChange[] {
  const out: CanvasDiffChange[] = [];
  const baseMap = new Map(base.map((r) => [r.id, r]));
  const otherMap = new Map(other.map((r) => [r.id, r]));
  for (const [id, row] of otherMap) {
    const prev = baseMap.get(id);
    if (!prev) {
      out.push({ kind, id, op: "added", label: labelOf(row) });
    } else if (!equal(prev, row)) {
      out.push({ kind, id, op: "changed", label: labelOf(row) });
    }
  }
  for (const [id, row] of baseMap) {
    if (!otherMap.has(id)) {
      out.push({ kind, id, op: "removed", label: labelOf(row) });
    }
  }
  return out;
}

/** Structural DesignCanvas diff for async VCS review. */
export function diffDesignCanvas(
  base: DesignCanvas | null | undefined,
  other: DesignCanvas | null | undefined,
): DesignCanvasDiff {
  const a = base;
  const b = other;
  const empty = {
    placements: [] as DesignCanvas["placements"],
    strokes: [] as DesignCanvas["strokes"],
    irrigation_zones: [] as NonNullable<DesignCanvas["irrigation_zones"]>,
    construction_trenches: [] as NonNullable<
      DesignCanvas["construction_trenches"]
    >,
    annotations: [] as NonNullable<DesignCanvas["annotations"]>,
    image_layers: [] as NonNullable<DesignCanvas["image_layers"]>,
    features: [] as NonNullable<DesignCanvas["features"]>,
  };
  const left = a ?? (empty as unknown as DesignCanvas);
  const right = b ?? (empty as unknown as DesignCanvas);

  const changes: CanvasDiffChange[] = [
    ...diffById(
      "placement",
      left.placements ?? [],
      right.placements ?? [],
      placementLabel,
      (x, y) =>
        x.symbol_id === y.symbol_id &&
        near(x, y) &&
        (x.rotation_deg ?? 0) === (y.rotation_deg ?? 0) &&
        (x.scale ?? 1) === (y.scale ?? 1),
    ),
    ...diffById(
      "stroke",
      left.strokes ?? [],
      right.strokes ?? [],
      (s) => `Stroke (${s.points?.length ?? 0} pts)`,
      (x, y) => JSON.stringify(x.points) === JSON.stringify(y.points),
    ),
    ...diffById(
      "irrigation_zone",
      left.irrigation_zones ?? [],
      right.irrigation_zones ?? [],
      (z) => z.name || z.kind || z.id.slice(0, 8),
      (x, y) => JSON.stringify(x) === JSON.stringify(y),
    ),
    ...diffById(
      "construction_trench",
      left.construction_trenches ?? [],
      right.construction_trenches ?? [],
      (t) => t.kind || t.id.slice(0, 8),
      (x, y) => JSON.stringify(x) === JSON.stringify(y),
    ),
    ...diffById(
      "annotation",
      left.annotations ?? [],
      right.annotations ?? [],
      (n) => n.text?.slice(0, 40) || n.id.slice(0, 8),
      (x, y) => JSON.stringify(x) === JSON.stringify(y),
    ),
    ...diffById(
      "image_layer",
      left.image_layers ?? [],
      right.image_layers ?? [],
      (l) => l.name || l.id.slice(0, 8),
      (x, y) => x.uri === y.uri,
    ),
    ...diffById(
      "feature",
      left.features ?? [],
      right.features ?? [],
      (f) => f.metadata?.layer || f.id.slice(0, 8),
      (x, y) => JSON.stringify(x) === JSON.stringify(y),
    ),
  ];

  return {
    changes,
    added: changes.filter((c) => c.op === "added").length,
    removed: changes.filter((c) => c.op === "removed").length,
    changed: changes.filter((c) => c.op === "changed").length,
  };
}
