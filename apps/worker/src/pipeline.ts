import { Job } from "bullmq";

export const PipelineStage = {
  CAPTURE: "CAPTURE",
  TRANSCRIBE: "TRANSCRIBE",
  GEOCODE: "GEOCODE",
  AERIAL: "AERIAL",
  TITLE: "TITLE",
  HOUSE: "HOUSE",
  GARDEN: "GARDEN",
  MEASURE: "MEASURE",
  MODE_DETECT: "MODE_DETECT",
  DESIGN: "DESIGN",
  GAP_FLAG: "GAP_FLAG",
  COST: "COST",
  AUDIT: "AUDIT",
  OUTPUTS: "OUTPUTS",
} as const;

export type PipelineStage =
  (typeof PipelineStage)[keyof typeof PipelineStage];

const STAGES = Object.values(PipelineStage);

async function runStage(stage: PipelineStage, data: unknown): Promise<unknown> {
  console.log(`Running stage: ${stage}`);
  return { stage, status: "ok" };
}

export async function processPipeline(job: Job): Promise<void> {
  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i];
    await runStage(stage, job.data);
    await job.updateProgress(Math.round(((i + 1) / STAGES.length) * 100));
  }
}
