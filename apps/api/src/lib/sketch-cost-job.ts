import type { Costing, Design } from "@workstream/contracts";
import {
  buildEnvelopeBrief,
  buildSketchCostingTotals,
  buildSketchLineItems,
  type EnvelopeBrief,
} from "@workstream/domain";
import type { Store } from "@workstream/db";

export type SketchEstimateResult = {
  costing: Costing;
  envelope: EnvelopeBrief;
};

async function ensureSketchDesign(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<Design> {
  const existing = await store.getDesign(ownerId, projectId);
  if (existing) return existing;

  return store.upsertDesign(ownerId, projectId, {
    mode: "gapfill",
    proposal: {
      zones: [],
      estimated_complexity: "standard",
    },
    gaps: [],
    rationale:
      "Sketch-stage placeholder. Run develop design from sketch to replace with a full AI proposal.",
  });
}

/** Approximate costing from design-studio placements (provisional line items). */
export async function runSketchCosting(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<SketchEstimateResult> {
  const project = await store.getProject(ownerId, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const survey = await store.getSurvey(ownerId, projectId);
  if (!survey) {
    throw new Error("Survey is required before a sketch estimate.");
  }

  const canvas = await store.getDesignCanvas(ownerId, projectId);
  if (!canvas?.placements?.length) {
    throw new Error(
      "Save a site sketch in design studio first — place trees, lawn, or paving on the aerial.",
    );
  }

  const symbols = await store.listCatalogSymbols(ownerId);
  const rates = await store.listRateCard(ownerId);
  const rateIndex = new Map(rates.map((r) => [r.sku, r]));

  const line_items = buildSketchLineItems(
    canvas.placements,
    symbols,
    survey,
    rateIndex,
  );
  if (line_items.length === 0) {
    throw new Error(
      "No sketch line items — place assets that have rate card SKUs (e.g. hornbeam, bluestone).",
    );
  }

  const design = await ensureSketchDesign(store, ownerId, projectId);
  const totals = buildSketchCostingTotals(line_items);

  const costing = await store.upsertCosting(ownerId, projectId, design.id, {
    scenario: "standard",
    ...totals,
  });

  await store.updateProjectStatus(ownerId, projectId, "cost_review");

  const envelope = buildEnvelopeBrief({
    project,
    survey,
    canvas,
    symbols,
    sketchCosting: costing,
  });

  return { costing, envelope };
}
