import { mkdir, rename, writeFile } from "fs/promises";
import path from "path";
import type { Store } from "@workstream/db";
import type { Output, OutputKind } from "@workstream/contracts";
import { generateForKind, type GeneratorArgs } from "./output-generators";
import { renderHtml } from "./html-render";
import { dispatchQuoteGenerated } from "./integration-dispatch";

const OUTPUT_DIR = path.join(process.cwd(), "data", "outputs");

export function outputPublicUrl(baseUrl: string, outputId: string): string {
  return `${baseUrl}/outputs/${outputId}.html`;
}

async function atomicWrite(filePath: string, body: string): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, body, "utf8");
  await rename(tmp, filePath);
}

const NEEDS_DESIGN: OutputKind[] = [
  "task_list",
  "schedule",
  "quote",
  "scope",
  "permit_stonnington_stormwater",
  "permit_yarra_heritage",
];
const NEEDS_AUDIT_PASS: OutputKind[] = ["quote"];

export async function runOutput(
  store: Store,
  ownerId: string,
  projectId: string,
  kind: OutputKind,
  baseUrl: string,
): Promise<Output> {
  if (kind === "brochure") {
    throw new Error("Brochure output is deferred (Phase 8 in spec).");
  }

  const project = await store.getProject(ownerId, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const survey = await store.getSurvey(ownerId, projectId);
  const design = await store.getDesign(ownerId, projectId);
  const costings = await store.listCostings(ownerId, projectId);
  const audit = await store.getAudit(ownerId, projectId);
  const tasks = await store.listTasks(ownerId, projectId);
  const designCanvas = await store.getDesignCanvas(ownerId, projectId);
  const catalogSymbols = await store.listCatalogSymbols(ownerId);
  const rateCard = await store.listRateCard(ownerId);

  if (NEEDS_DESIGN.includes(kind)) {
    if (!survey) {
      throw new Error("Survey is required before generating outputs.");
    }
    if (!design) {
      throw new Error("Design is required before generating outputs.");
    }
  }
  if (NEEDS_AUDIT_PASS.includes(kind)) {
    if (costings.length === 0) {
      throw new Error("Costing is required before generating outputs.");
    }
    if (audit && !audit.passed) {
      throw new Error(
        "Audit has blocking findings. Resolve or override before generating outputs.",
      );
    }
  }

  const args: GeneratorArgs = {
    project,
    survey,
    design,
    designCanvas,
    catalogSymbols,
    rateCard,
    costings,
    audit,
    tasks,
  };
  const markdown = generateForKind(kind, args);
  const html = renderHtml({ kind, project, markdown });

  await mkdir(OUTPUT_DIR, { recursive: true });

  const output = await store.upsertOutput(ownerId, projectId, kind, {
    uri: "",
    generated_at: new Date().toISOString(),
  });

  // Write both .md (machine-readable, integrations, ledger of record) and
  // .html (client-facing, opens in any browser, prints to clean PDF).
  // Atomic writes via .tmp + rename so a crash mid-write can't poison the
  // file the next deploy serves.
  const mdPath = path.join(OUTPUT_DIR, `${output.id}.md`);
  const htmlPath = path.join(OUTPUT_DIR, `${output.id}.html`);
  await Promise.all([atomicWrite(mdPath, markdown), atomicWrite(htmlPath, html)]);

  const uri = outputPublicUrl(baseUrl, output.id);
  const saved = await store.upsertOutput(ownerId, projectId, kind, {
    uri,
    generated_at: output.generated_at,
  });

  await store.updateProjectStatus(ownerId, projectId, "outputs");

  if (kind === "quote") {
    void dispatchQuoteGenerated(store, ownerId, project, {
      quote_url: uri,
    }).catch(() => {
      /* logged per-channel in integration events */
    });
  }

  return saved;
}
