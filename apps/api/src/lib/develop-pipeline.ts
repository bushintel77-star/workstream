import type { Store } from "@workstream/db";
import { runDesign } from "./design-job";
import { runCosting } from "./cost-job";
import { runProjectAudit } from "./audit-job";
import type { PipelineEvent, PipelineResult } from "./pipeline-job";

/** After site sketch: AI design → full costing → audit. */
export async function runDevelopFromSketchPipeline(
  store: Store,
  ownerId: string,
  projectId: string,
  onEvent?: (event: PipelineEvent) => void,
): Promise<PipelineResult> {
  const events: PipelineEvent[] = [];
  const emit = (e: PipelineEvent) => {
    events.push(e);
    onEvent?.(e);
  };

  const canvas = await store.getDesignCanvas(ownerId, projectId);
  if (!canvas?.placements?.length) {
    return {
      events: [
        {
          stage: "design",
          status: "error",
          error:
            "Save a site sketch in design studio before developing the AI design.",
        },
      ],
      ok: false,
    };
  }

  await store.updateProjectStatus(ownerId, projectId, "processing");

  const stages = [
    { name: "design" as const, run: () => runDesign(store, ownerId, projectId) },
    { name: "costing" as const, run: () => runCosting(store, ownerId, projectId) },
    { name: "audit" as const, run: () => runProjectAudit(store, ownerId, projectId) },
  ];

  for (const stage of stages) {
    emit({ stage: stage.name, status: "running" });
    try {
      await stage.run();
      emit({ stage: stage.name, status: "ok" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stage failed";
      emit({ stage: stage.name, status: "error", error: message });
      return { events, ok: false };
    }
  }

  emit({ stage: "complete", status: "ok" });
  await store.updateProjectStatus(ownerId, projectId, "audit");
  return { events, ok: true };
}
