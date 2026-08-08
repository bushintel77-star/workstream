import type {
  CadBlock,
  CadDocument,
  CadEntity,
  DesignCanvas,
} from "@workstream/contracts";
import { DEFAULT_CAD_LAYERS } from "./defaults";
import { pctToCadMetres, stampSiteFrameToCad } from "./stamp-site-frame";

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
 * Placements → INSERT blocks; strokes → SKETCH-REF polylines; irrigation → IRRIGATION.
 * Site frame rings are stamped in the same metre frame.
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
    const pos = pctToCadMetres(p.x_pct, p.y_pct, width_m, height_m);
    entities.push({
      id: crypto.randomUUID(),
      kind: "insert",
      layer: layerForSymbol(p.symbol_id),
      ghost: false,
      verification_state: "VERIFIED",
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
      verification_state: "VERIFIED",
      closed: false,
      points: stroke.points.map((pt) =>
        pctToCadMetres(pt.x_pct, pt.y_pct, width_m, height_m),
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
      verification_state: "VERIFIED",
      closed: false,
      points: zone.points.map((pt) =>
        pctToCadMetres(pt.x_pct, pt.y_pct, width_m, height_m),
      ),
    });
    const mid = zone.points[Math.floor(zone.points.length / 2)]!;
    const pos = pctToCadMetres(mid.x_pct, mid.y_pct, width_m, height_m);
    entities.push({
      id: crypto.randomUUID(),
      kind: "text",
      layer: "ANNOTATION",
      ghost: false,
      verification_state: "VERIFIED",
      position: pos,
      height: 0.4,
      value: zone.name || "Irrigation",
      rotation_deg: 0,
    });
  }

  for (const ann of canvas.annotations ?? []) {
    const pos = pctToCadMetres(
      ann.notePos.x,
      ann.notePos.y,
      width_m,
      height_m,
    );
    entities.push({
      id: crypto.randomUUID(),
      kind: "text",
      layer: "ANNOTATION",
      ghost: false,
      verification_state: "VERIFIED",
      position: pos,
      height: 0.35,
      value: ann.text || "Note",
      rotation_deg: 0,
    });
  }

  const base: CadDocument = {
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

  return stampSiteFrameToCad(base, canvas);
}
