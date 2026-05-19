import type { Store } from "@workstream/db";
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
      return { events, ok: false };
    }
  }

  emit({ stage: "complete", status: "ok" });
  return { events, ok: true };
}
