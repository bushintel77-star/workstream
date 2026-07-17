import type {
  CadBlock,
  CadDocument,
  CadEntity,
  DesignCanvas,
} from "@workstream/contracts";
import { DEFAULT_CAD_LAYERS } from "./defaults";

function pctToMetres(
  x_pct: number,
  y_pct: number,
  width_m: number,
  height_m: number,
): { x: number; y: number } {
  // CAD Y-up: screen top (y_pct=0) ? high Y
  return {
    x: (x_pct / 100) * width_m,
    y: ((100 - y_pct) / 100) * height_m,
  };
}

function layerForSymbol(symbolId: string): string {
  const id = symbolId.toLowerCase();
  if (id.includes("trp") || id.includes("tree") || id.includes("tpz")) {
    return "TRP";
  }
  if (id.includes("irr") || id.includes("drip")) return "IRRIGATION";
  if (
    id.includes("pave") ||
    id.includes("bluestone") ||
    id.includes("path") ||
    id.includes("lawn")
  ) {
    return "HARDSCAPE";
  }
  if (id.includes("pool") || id.includes("pond") || id.includes("water")) {
    return "WATER";
  }
  if (id.includes("fence") || id.includes("wall") || id.includes("retaining")) {
    return "STRUCTURES";
  }
  return "PLANTING";
}

/**
 * Promote Workflow 1 DesignCanvas into a Stage 2 CadDocument (committed sketch-ref).
 * Placements ? INSERT blocks; strokes ? SKETCH-REF polylines; irrigation ? IRRIGATION.
 */
export function importSketchToCad(args: {
  projectId: string;
  canvas: DesignCanvas;
  width_m: number;
  height_m: number;
}): CadDocument {
  const { projectId, canvas, width_m, height_m } = args;
  const now = new Date().toISOString();
  const entities: CadEntity[] = [];
  const blocks = new Map<string, CadBlock>();

  for (const p of canvas.placements) {
    const blockName = p.symbol_id;
    if (!blocks.has(blockName)) {
      blocks.set(blockName, {
        name: blockName,
        symbol_id: p.symbol_id,
        entities: [],
      });
    }
    const pos = pctToMetres(p.x_pct, p.y_pct, width_m, height_m);
    entities.push({
      id: crypto.randomUUID(),
      kind: "insert",
      layer: layerForSymbol(p.symbol_id),
      ghost: false,
      block_name: blockName,
      position: pos,
      scale: p.scale ?? 1,
      rotation_deg: p.rotation_deg ?? 0,
    });
  }

  for (const stroke of canvas.strokes ?? []) {
    if (!stroke.points?.length || stroke.points.length < 2) continue;
    entities.push({
      id: crypto.randomUUID(),
      kind: "polyline",
      layer: "SKETCH-REF",
      ghost: false,
      closed: false,
      points: stroke.points.map((pt) =>
        pctToMetres(pt.x_pct, pt.y_pct, width_m, height_m),
      ),
    });
  }

  for (const zone of canvas.irrigation_zones ?? []) {
    if (!zone.points || zone.points.length < 2) continue;
    entities.push({
      id: crypto.randomUUID(),
      kind: "polyline",
      layer: "IRRIGATION",
      ghost: false,
      closed: false,
      points: zone.points.map((pt) =>
        pctToMetres(pt.x_pct, pt.y_pct, width_m, height_m),
      ),
    });
    const mid = zone.points[Math.floor(zone.points.length / 2)]!;
    const pos = pctToMetres(mid.x_pct, mid.y_pct, width_m, height_m);
    entities.push({
      id: crypto.randomUUID(),
      kind: "text",
      layer: "ANNOTATION",
      ghost: false,
      position: pos,
      height: 0.4,
      value: zone.name || "Irrigation",
      rotation_deg: 0,
    });
  }

  for (const ann of canvas.annotations ?? []) {
    const pos = pctToMetres(ann.x_pct, ann.y_pct, width_m, height_m);
    if (ann.kind === "text") {
      entities.push({
        id: crypto.randomUUID(),
        kind: "text",
        layer: "ANNOTATION",
        ghost: false,
        position: pos,
        height: 0.35,
        value: ann.text || "Note",
        rotation_deg: 0,
      });
    } else if (
      (ann.kind === "dimension" || ann.kind === "arrow") &&
      ann.x2_pct != null &&
      ann.y2_pct != null
    ) {
      const p2 = pctToMetres(ann.x2_pct, ann.y2_pct, width_m, height_m);
      if (ann.kind === "dimension") {
        entities.push({
          id: crypto.randomUUID(),
          kind: "dimension",
          layer: "DIMENSIONS",
          ghost: false,
          p1: pos,
          p2,
          offset: 0.5,
        });
      } else {
        entities.push({
          id: crypto.randomUUID(),
          kind: "line",
          layer: "ANNOTATION",
          ghost: false,
          start: pos,
          end: p2,
        });
      }
    }
  }

  return {
    id: crypto.randomUUID(),
    project_id: projectId,
    version: 1,
    units: "m",
    origin: { x: 0, y: 0 },
    width_m,
    height_m,
    layers: DEFAULT_CAD_LAYERS.map((l) => ({ ...l })),
    entities,
    blocks: [...blocks.values()],
    ai_run_id: null,
    source_sketch_id: canvas.id,
    updated_at: now,
  };
}
