import type { ProjectStatus } from "@workstream/contracts";

export type ProcessingStage = {
  key: string;
  label: string;
  done: boolean;
  active: boolean;
  failed: boolean;
};

const STAGE_LABELS: Record<string, string> = {
  transcription: "Transcribing walkthrough",
  survey: "Surveying site",
  design: "Generating design",
  costing: "Costing scenarios",
  audit: "Self-audit",
  outputs: "Packaging outputs",
  complete: "Complete",
};

export function buildProcessingStages(args: {
  hasTranscript: boolean;
  hasSurvey: boolean;
  hasDesign: boolean;
  hasCosting: boolean;
  hasAudit: boolean;
  hasOutputs: boolean;
  status: ProjectStatus | null;
}): ProcessingStage[] {
  const status = args.status ?? "processing";
  const order = [
    { key: "transcription", done: args.hasTranscript },
    { key: "survey", done: args.hasSurvey },
    { key: "design", done: args.hasDesign },
    { key: "costing", done: args.hasCosting },
    { key: "audit", done: args.hasAudit },
    { key: "outputs", done: args.hasOutputs },
    { key: "complete", done: status === "complete" },
  ];

  const failedKey = status.endsWith("_failed")
    ? status.replace("_failed", "")
    : null;
  const firstOpen = order.findIndex((stage) => !stage.done);

  return order.map((stage, index) => {
    const failed = failedKey === stage.key;
    const active =
      !stage.done &&
      (failed || index === firstOpen) &&
      status !== "complete";
    return {
      key: stage.key,
      label: STAGE_LABELS[stage.key] ?? stage.key,
      done: stage.done,
      active,
      failed,
    };
  });
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}
