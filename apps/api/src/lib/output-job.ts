import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { Store } from "@walkthrough/db";
import type { Output, OutputKind } from "@walkthrough/contracts";
import { generateForKind } from "./output-generators";

const OUTPUT_DIR = path.join(process.cwd(), "data", "outputs");

export function outputPublicUrl(baseUrl: string, outputId: string): string {
  return `${baseUrl}/outputs/${outputId}.md`;
}

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
  if (!survey) throw new Error("Survey is required before generating outputs.");

  const design = await store.getDesign(ownerId, projectId);
  if (!design) throw new Error("Design is required before generating outputs.");

  const costings = await store.listCostings(ownerId, projectId);
  if (costings.length === 0) {
    throw new Error("Costing is required before generating outputs.");
  }

  const audit = await store.getAudit(ownerId, projectId);
  if (audit && !audit.passed) {
    throw new Error(
      "Audit has blocking findings. Resolve or override before generating outputs.",
    );
  }

  const markdown = generateForKind(kind, {
    project,
    survey,
    design,
    costings,
    audit,
  });

  await mkdir(OUTPUT_DIR, { recursive: true });

  const output = await store.upsertOutput(ownerId, projectId, kind, {
    uri: "",
    generated_at: new Date().toISOString(),
  });

  const filePath = path.join(OUTPUT_DIR, `${output.id}.md`);
  await writeFile(filePath, markdown, "utf8");

  const uri = outputPublicUrl(baseUrl, output.id);
  const saved = await store.upsertOutput(ownerId, projectId, kind, {
    uri,
    generated_at: output.generated_at,
  });

  await store.updateProjectStatus(ownerId, projectId, "outputs");
  return saved;
}
