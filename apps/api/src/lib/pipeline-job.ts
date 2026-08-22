import type { Store } from "@workstream/db";
import type { ProjectStatus } from "@workstream/contracts";
import { runSurvey } from "./survey-job";
import { runDesign } from "./design-job";
import { runCosting } from "./cost-job";
import { runProjectAudit } from "./audit-job";

export type PipelineStage =
  | "survey"
  | "design"
  | "costing"
  | "audit"
  | "complete";

export type PipelineEvent =
  | { stage: Exclude<PipelineStage, "complete">; status: "running" | "ok" }
  | { stage: PipelineStage; status: "error"; error: string }
  | { stage: "complete"; status: "ok" };

export type PipelineResult = {
  events: PipelineEvent[];
  ok: boolean;
};

export async function runFullPipeline(
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

  await store.updateProjectStatus(ownerId, projectId, "processing");

  const stages: Array<{
    name: Exclude<PipelineStage, "complete">;
    run: () => Promise<unknown>;
  }> = [
    { name: "survey", run: () => runSurvey(store, ownerId, projectId) },
    { name: "design", run: () => runDesign(store, ownerId, projectId) },
    { name: "costing", run: () => runCosting(store, ownerId, projectId) },
    { name: "audit", run: () => runProjectAudit(store, ownerId, projectId) },
  ];

  for (const stage of stages) {
    emit({ stage: stage.name, status: "running" });
    try {
      await stage.run();
      emit({ stage: stage.name, status: "ok" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stage failed";
      emit({ stage: stage.name, status: "error", error: message });
      /* A stage failure must leave the project in a visible failed state,
       * not stuck at "processing" with no way for the UI to distinguish a
       * running pipeline from a dead one. The retry route reads the stage
       * log to resume from here. */
      await store
        .updateProjectStatus(
          ownerId,
          projectId,
          `${stage.name}_failed` as ProjectStatus,
        )
        .catch(() => undefined);
      return { events, ok: false };
    }
  }

  emit({ stage: "complete", status: "ok" });
  const project = await store.getProject(ownerId, projectId);
  if (project && project.status === "processing") {
    await store.updateProjectStatus(ownerId, projectId, "audit");
  }
  return { events, ok: true };
}
