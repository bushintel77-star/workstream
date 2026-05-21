import type { Store } from "@workstream/db";
import type { Design } from "@workstream/contracts";
import { formatSketchBriefForAi } from "@workstream/domain";
import { detectMode } from "./mode-detect";
import { generateDesign } from "./claude";

export async function runDesign(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<Design> {
  const project = await store.getProject(ownerId, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const survey = await store.getSurvey(ownerId, projectId);
  if (!survey) {
    throw new Error("Survey is required before generating a design.");
  }

  const recordings = await store.listRecordings(ownerId, projectId);
  const transcript = recordings.find((r) => r.transcript)?.transcript ?? null;

  const detected = detectMode(transcript);
  const palette = await store.listPlantPalette(ownerId);
  const rates = await store.listRateCard(ownerId);
  const canvas = await store.getDesignCanvas(ownerId, projectId);
  const catalogSymbols = await store.listCatalogSymbols(ownerId);
  const sketch_brief = formatSketchBriefForAi(
    canvas,
    catalogSymbols,
    survey,
    project.address,
  );

  const generation = await generateDesign({
    address: project.address,
    transcript,
    survey,
    mode: detected.mode,
    plant_palette: palette,
    rate_card: rates,
    sketch_brief,
  });

  const design = await store.upsertDesign(ownerId, projectId, {
    mode: detected.mode,
    proposal: generation.proposal,
    gaps: generation.gaps,
    rationale: generation.rationale,
  });

  await store.updateProjectStatus(ownerId, projectId, "design_review");
  return design;
}
