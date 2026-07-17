import type { Store } from "@workstream/db";
import type { CostScenario, Project } from "@workstream/contracts";
import {
  buildFromCad,
  cadQuantitySurvey,
  type CadBuildSchedule,
  type CadQuantitySurvey,
} from "@workstream/domain";
import { renderHtml } from "./html-render";

function cadQuoteMarkdown(
  project: Project,
  build: CadBuildSchedule,
): string {
  const lines = build.line_items
    .map(
      (l) =>
        `| ${l.sku} | ${l.label} | ${l.qty} ${l.unit} | $${l.rate.toFixed(2)} | $${l.total.toFixed(2)} |`,
    )
    .join("\n");
  return [
    `# Quote — ${project.address}`,
    ``,
    `_Working-planning CAD quantities · ${build.scenario} contingency · not a formal contract until signed._`,
    ``,
    `## Itemised build`,
    ``,
    `| SKU | Description | Qty | Rate | Total |`,
    `| --- | --- | --- | --- | --- |`,
    lines || `| — | No priced CAD quantities yet | — | — | — |`,
    ``,
    `## Totals`,
    ``,
    `- Subtotal: **$${build.subtotal.toFixed(2)}**`,
    `- Contingency (${build.scenario}): **$${build.contingency.toFixed(2)}**`,
    `- GST: **$${build.gst.toFixed(2)}**`,
    `- **Total: $${build.total.toFixed(2)}**`,
    ``,
    `## Quantity survey summary`,
    ``,
    `- Hardscape: ${build.survey.totals.hardscape_m2} m²`,
    `- Planting: ${build.survey.totals.planting_ea} ea`,
    `- Irrigation: ${build.survey.totals.irrigation_lm} lm`,
    `- Structures: ${build.survey.totals.structure_m2} m²`,
    ``,
    `— Curtis & Co · Workstream`,
  ].join("\n");
}

async function requireCadDoc(store: Store, ownerId: string, projectId: string) {
  const document = await store.getCadDocument(ownerId, projectId);
  if (!document) {
    throw new Error("No CAD document — generate AI CAD on the canvas first.");
  }
  const committed = document.entities.filter((e) => !e.ghost);
  if (committed.length === 0) {
    throw new Error("Accept CAD ghosts before running quantity survey.");
  }
  return document;
}

export async function runCadQuantitySurvey(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<CadQuantitySurvey> {
  const document = await requireCadDoc(store, ownerId, projectId);
  return cadQuantitySurvey(document, { committedOnly: true });
}

export async function runCadBuild(
  store: Store,
  ownerId: string,
  projectId: string,
  scenario: CostScenario = "standard",
): Promise<CadBuildSchedule> {
  const document = await requireCadDoc(store, ownerId, projectId);
  const rates = await store.listRateCard(ownerId);
  const build = buildFromCad(document, rates, {
    committedOnly: true,
    scenario,
  });

  const design = await store.getDesign(ownerId, projectId);
  if (design) {
    const priced = build.line_items.filter((l) => l.qty > 0);
    await store.upsertCosting(ownerId, projectId, design.id, {
      scenario,
      line_items: priced,
      subtotal: build.subtotal + build.contingency,
      gst: build.gst,
      total: build.total,
    });
  }

  return build;
}

export async function runCadQuote(
  store: Store,
  ownerId: string,
  projectId: string,
  scenario: CostScenario = "standard",
): Promise<{
  build: CadBuildSchedule;
  survey: CadQuantitySurvey;
  markdown: string;
  html: string;
}> {
  const project = await store.getProject(ownerId, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const build = await runCadBuild(store, ownerId, projectId, scenario);
  const markdown = cadQuoteMarkdown(project, build);
  const html = renderHtml({ kind: "quote", project, markdown });
  return { build, survey: build.survey, markdown, html };
}
