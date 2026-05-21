import { buildEnvelopeBrief, type EnvelopeBrief } from "@workstream/domain";
import type { Store } from "@workstream/db";

export async function getEnvelopeBrief(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<EnvelopeBrief | null> {
  const project = await store.getProject(ownerId, projectId);
  if (!project) return null;

  const survey = await store.getSurvey(ownerId, projectId);
  if (!survey) return null;

  const canvas = await store.getDesignCanvas(ownerId, projectId);
  const symbols = await store.listCatalogSymbols(ownerId);
  const costings = await store.listCostings(ownerId, projectId);
  const sketchCosting =
    costings.find((c) =>
      c.line_items.some((li) => li.label.includes("sketch ·")),
    ) ?? costings.find((c) => c.scenario === "standard");

  return buildEnvelopeBrief({
    project,
    survey,
    canvas,
    symbols,
    sketchCosting: sketchCosting ?? null,
  });
}
