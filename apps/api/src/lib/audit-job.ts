import type { Store } from "@workstream/db";
import type { Audit } from "@workstream/contracts";
import { runAudit } from "./claude";

export async function runProjectAudit(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<Audit> {
  const design = await store.getDesign(ownerId, projectId);
  if (!design) throw new Error("Design is required before audit.");

  const costings = await store.listCostings(ownerId, projectId);
  if (costings.length === 0) throw new Error("Costing is required before audit.");

  const recordings = await store.listRecordings(ownerId, projectId);
  const transcript = recordings.find((r) => r.transcript)?.transcript ?? null;

  const { findings } = await runAudit({ transcript, design, costings });

  const blocking_count = findings.filter((f) => f.severity === "blocking").length;
  const advisory_count = findings.filter((f) => f.severity === "advisory").length;
  const passed = blocking_count === 0;

  const audit = await store.upsertAudit(ownerId, projectId, design.id, {
    findings,
    blocking_count,
    advisory_count,
    passed,
  });

  await store.updateProjectStatus(ownerId, projectId, "audit");
  return audit;
}
