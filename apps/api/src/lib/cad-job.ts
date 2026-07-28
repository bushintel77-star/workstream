import type { Store } from "@workstream/db";
import type { CadDocument, DesignCanvas } from "@workstream/contracts";
import {
  acceptCadGhosts,
  applyCadOps,
  cadDocumentToDxf,
  cadDocumentToSvg,
  countGhosts,
  emptyCadDocument,
  importSketchToCad,
  stampSiteFrameToCad,
} from "@workstream/cad";
import type { CadOp } from "@workstream/contracts";
import {
  formatPlanningFlagsForAi,
  assessPlanningFromSketch,
  resolvePlanMetres,
  type PlanMetres,
} from "@workstream/domain";
import { generateCadOps } from "./claude";
import { groundSpanFromSurvey } from "./cad-ground";

function entityBrief(doc: CadDocument): string {
  return doc.entities
    .slice(0, 40)
    .map((e) => {
      if (e.kind === "polyline") {
        return `${e.id} polyline layer=${e.layer} ghost=${e.ghost} pts=${e.points.length}`;
      }
      if (e.kind === "circle") {
        return `${e.id} circle layer=${e.layer} ghost=${e.ghost} r=${e.radius.toFixed(2)}`;
      }
      if (e.kind === "insert") {
        return `${e.id} insert ${e.block_name} ghost=${e.ghost}`;
      }
      return `${e.id} ${e.kind} layer=${e.layer} ghost=${e.ghost}`;
    })
    .join("\n");
}

function sketchSummary(canvas: {
  placements: { symbol_id: string }[];
  strokes: unknown[];
  irrigation_zones: unknown[];
}): string {
  const counts = new Map<string, number>();
  for (const p of canvas.placements) {
    counts.set(p.symbol_id, (counts.get(p.symbol_id) ?? 0) + 1);
  }
  const lines = [...counts.entries()].map(([id, n]) => `${id} × ${n}`);
  return [
    `placements: ${canvas.placements.length}`,
    `strokes: ${canvas.strokes?.length ?? 0}`,
    `irrigation_zones: ${canvas.irrigation_zones?.length ?? 0}`,
    ...lines.slice(0, 30),
  ].join("\n");
}

function planFromSurveyAndCanvas(
  survey: Parameters<typeof groundSpanFromSurvey>[0],
  canvas: DesignCanvas | null,
): PlanMetres {
  const span = groundSpanFromSurvey(survey);
  const aspect =
    span.width_m > 0 ? span.height_m / span.width_m : 1;
  return resolvePlanMetres({
    boardWidthM: canvas?.site_frame?.board_width_m ?? null,
    boardAspect: aspect,
    surveySpan: {
      width_m: span.width_m,
      height_m: span.height_m,
      outdoor_area_m2: span.outdoor_area_m2,
      fromAerial: span.fromAerial,
    },
  });
}

function canvasHasSketchContent(canvas: DesignCanvas | null): boolean {
  if (!canvas) return false;
  return (
    (canvas.placements?.length ?? 0) > 0 ||
    (canvas.strokes?.length ?? 0) > 0 ||
    (canvas.irrigation_zones?.length ?? 0) > 0 ||
    (canvas.annotations?.length ?? 0) > 0
  );
}

function canvasHasSiteFrame(canvas: DesignCanvas | null): boolean {
  const f = canvas?.site_frame;
  if (!f) return false;
  return (
    f.boundary.length >= 3 ||
    f.building.length >= 3 ||
    (f.easements?.some((r) => r.length >= 2) ?? false)
  );
}

async function persist(
  store: Store,
  ownerId: string,
  projectId: string,
  doc: CadDocument,
): Promise<CadDocument> {
  return store.upsertCadDocument(ownerId, projectId, {
    version: 1,
    units: "m",
    origin: doc.origin,
    width_m: doc.width_m,
    height_m: doc.height_m,
    layers: doc.layers,
    entities: doc.entities,
    blocks: doc.blocks,
    ai_run_id: doc.ai_run_id,
    source_sketch_id: doc.source_sketch_id,
  });
}

export async function getCadWithSvg(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<{ document: CadDocument | null; svg: string | null; ghost_count: number }> {
  const document = await store.getCadDocument(ownerId, projectId);
  if (!document) {
    return { document: null, svg: null, ghost_count: 0 };
  }
  return {
    document,
    svg: cadDocumentToSvg(document),
    ghost_count: countGhosts(document),
  };
}

/**
 * Metre-space CAD sheet: prefer calibrated board width, stamp site frame,
 * import sketch when present. Working-plan honesty — not survey lodgement.
 */
export async function ensureCadDocument(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<{ document: CadDocument; svg: string; ghost_count: number }> {
  const existing = await store.getCadDocument(ownerId, projectId);
  if (existing) {
    return {
      document: existing,
      svg: cadDocumentToSvg(existing),
      ghost_count: countGhosts(existing),
    };
  }
  const survey = await store.getSurvey(ownerId, projectId);
  if (!survey) throw new Error("Survey required before CAD");
  const canvas = await store.getDesignCanvas(ownerId, projectId);
  const plan = planFromSurveyAndCanvas(survey, canvas);

  let doc: CadDocument;
  if (canvasHasSketchContent(canvas)) {
    doc = importSketchToCad({
      projectId,
      canvas: canvas!,
      width_m: plan.width_m,
      height_m: plan.height_m,
    });
  } else {
    const seed = emptyCadDocument({
      projectId,
      width_m: plan.width_m,
      height_m: plan.height_m,
      source_sketch_id: canvas?.id ?? null,
    });
    doc = {
      ...seed,
      id: crypto.randomUUID(),
      updated_at: new Date().toISOString(),
    } as CadDocument;
    if (canvasHasSiteFrame(canvas)) {
      doc = stampSiteFrameToCad(doc, canvas);
    }
  }

  const saved = await persist(store, ownerId, projectId, doc);
  return {
    document: saved,
    svg: cadDocumentToSvg(saved),
    ghost_count: countGhosts(saved),
  };
}

/** Apply deterministic CAD ops (line draw) onto the project sheet. */
export async function applyCadOpsBatch(
  store: Store,
  ownerId: string,
  projectId: string,
  ops: CadOp[],
): Promise<{
  document: CadDocument;
  svg: string;
  ghost_count: number;
  applied: number;
}> {
  const ensured = await ensureCadDocument(store, ownerId, projectId);
  const { document: next, applied } = applyCadOps(ensured.document, ops);
  const saved = await persist(store, ownerId, projectId, next);
  return {
    document: saved,
    svg: cadDocumentToSvg(saved),
    ghost_count: countGhosts(saved),
    applied,
  };
}

export async function generateCadDocument(
  store: Store,
  ownerId: string,
  projectId: string,
  opts?: { width_m?: number; height_m?: number },
): Promise<{
  document: CadDocument;
  svg: string;
  ghost_count: number;
  rationale: string;
  applied: number;
}> {
  const project = await store.getProject(ownerId, projectId);
  if (!project) throw new Error("Project not found");
  const survey = await store.getSurvey(ownerId, projectId);
  if (!survey) throw new Error("Survey required before AI CAD");
  const canvas = await store.getDesignCanvas(ownerId, projectId);
  if (!canvas?.placements?.length) {
    throw new Error("Save a site sketch before generating AI CAD");
  }

  const plan = planFromSurveyAndCanvas(survey, canvas);
  const width_m = opts?.width_m ?? plan.width_m;
  const height_m = opts?.height_m ?? plan.height_m;
  const outdoor_area_m2 = plan.outdoor_area_m2 ?? 0;

  let doc = await store.getCadDocument(ownerId, projectId);
  if (!doc) {
    doc = importSketchToCad({
      projectId,
      canvas,
      width_m,
      height_m,
    });
  }

  const symbols = await store.listCatalogSymbols(ownerId);
  const planning = assessPlanningFromSketch(
    project.address,
    survey,
    canvas,
    symbols,
  );

  const { ops, rationale } = await generateCadOps({
    address: project.address,
    width_m: doc.width_m,
    height_m: doc.height_m,
    sketch_summary: [
      sketchSummary(canvas),
      `Outdoor area (working plan): ${outdoor_area_m2} m²`,
      `CAD template: ${width_m.toFixed(1)} m × ${height_m.toFixed(1)} m (${plan.source})`,
      `Garden ${survey.garden_area_m2} m² · lot ${survey.lot_area_m2} m² · house ${survey.house_area_m2} m²`,
      "Honesty: working plan metres — confirm on site",
    ].join("\n"),
    planning_notes: formatPlanningFlagsForAi(planning),
    existing_entity_brief: entityBrief(doc),
    catalog_symbol_ids: symbols.map((s) => s.id),
  });

  const runId = crypto.randomUUID();
  const { document: next, applied } = applyCadOps(doc, ops);
  next.ai_run_id = runId;
  next.source_sketch_id = canvas.id;
  const saved = await persist(store, ownerId, projectId, next);

  return {
    document: saved,
    svg: cadDocumentToSvg(saved),
    ghost_count: countGhosts(saved),
    rationale: `${rationale} Working-plan template ${outdoor_area_m2} m² (${plan.source}).`,
    applied,
  };
}

export async function editCadDocument(
  store: Store,
  ownerId: string,
  projectId: string,
  instruction: string,
): Promise<{
  document: CadDocument;
  svg: string;
  ghost_count: number;
  rationale: string;
  applied: number;
}> {
  const project = await store.getProject(ownerId, projectId);
  if (!project) throw new Error("Project not found");
  let doc = await store.getCadDocument(ownerId, projectId);
  if (!doc) {
    const ensured = await ensureCadDocument(store, ownerId, projectId);
    doc = ensured.document;
  }

  const canvas = await store.getDesignCanvas(ownerId, projectId);
  const survey = await store.getSurvey(ownerId, projectId);
  const symbols = await store.listCatalogSymbols(ownerId);
  const planning =
    canvas && survey
      ? assessPlanningFromSketch(project.address, survey, canvas, symbols)
      : [];

  const { ops, rationale } = await generateCadOps({
    address: project.address,
    width_m: doc.width_m,
    height_m: doc.height_m,
    sketch_summary: canvas ? sketchSummary(canvas) : "(no sketch)",
    planning_notes: formatPlanningFlagsForAi(planning),
    instruction,
    existing_entity_brief: entityBrief(doc),
    catalog_symbol_ids: symbols.map((s) => s.id),
  });

  const { document: next, applied } = applyCadOps(doc, ops);
  next.ai_run_id = crypto.randomUUID();
  const saved = await persist(store, ownerId, projectId, next);

  return {
    document: saved,
    svg: cadDocumentToSvg(saved),
    ghost_count: countGhosts(saved),
    rationale,
    applied,
  };
}

export async function acceptCadDocument(
  store: Store,
  ownerId: string,
  projectId: string,
  entityIds?: string[],
): Promise<{ document: CadDocument; svg: string; ghost_count: number }> {
  const doc = await store.getCadDocument(ownerId, projectId);
  if (!doc) throw new Error("No CAD document — generate first");
  const next = acceptCadGhosts(doc, entityIds);
  const saved = await persist(store, ownerId, projectId, next);
  return {
    document: saved,
    svg: cadDocumentToSvg(saved),
    ghost_count: countGhosts(saved),
  };
}

/** Ensure a calibrated metre sheet exists, then emit DXF. */
export async function exportCadDxf(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<string> {
  let doc = await store.getCadDocument(ownerId, projectId);
  if (!doc) {
    const ensured = await ensureCadDocument(store, ownerId, projectId);
    doc = ensured.document;
  }
  return cadDocumentToDxf(doc);
}
