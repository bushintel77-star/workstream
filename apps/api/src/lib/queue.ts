/**
 * BullMQ pipeline queue. Inline execution when REDIS_URL is unset.
 */

import type { Store } from "@workstream/db";
import { runFullPipeline } from "./pipeline-job";
import { runSurvey } from "./survey-job";
import { runDesign } from "./design-job";
import { runCosting } from "./cost-job";
import { runProjectAudit } from "./audit-job";
import { bindOwnerSecrets } from "./owner-secrets";
import { withTelemetrySpan } from "./telemetry";

type JobKind =
  | "survey"
  | "design"
  | "costing"
  | "audit"
  | "output"
  | "pipeline";

export type PipelineJobPayload = {
  kind: JobKind;
  ownerId: string;
  projectId: string;
  outputKind?: string;
};

export function isQueueEnabled(): boolean {
  return !!process.env.REDIS_URL;
}

let queueRef: unknown = null;

export async function enqueuePipelineJob(
  payload: PipelineJobPayload,
): Promise<{ enqueued: boolean; jobId?: string }> {
  if (!isQueueEnabled()) return { enqueued: false };
  try {
    const { Queue } = await import("bullmq");
    if (!queueRef) {
      queueRef = new Queue("workstream-pipeline", {
        connection: { url: process.env.REDIS_URL },
      });
    }
    const queue = queueRef as InstanceType<typeof Queue>;
    const job = await queue.add(payload.kind, payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    });
    return { enqueued: true, jobId: job.id };
  } catch (err) {
    console.warn(
      "[queue] enqueue failed — falling back to inline execution",
      err,
    );
    return { enqueued: false };
  }
}

async function runJob(store: Store, payload: PipelineJobPayload): Promise<void> {
  await withTelemetrySpan(
    `pipeline.job.${payload.kind}`,
    {
      "pipeline.stage": payload.kind,
      "operator.id": payload.ownerId,
      "project.id": payload.projectId,
    },
    async () => {
      store.reloadSnapshot();
      await bindOwnerSecrets(store, payload.ownerId);
      const { kind, ownerId, projectId } = payload;
      switch (kind) {
        case "pipeline":
          await runFullPipeline(store, ownerId, projectId);
          break;
        case "survey":
          await runSurvey(store, ownerId, projectId);
          break;
        case "design":
          await runDesign(store, ownerId, projectId);
          break;
        case "costing":
          await runCosting(store, ownerId, projectId);
          break;
        case "audit":
          await runProjectAudit(store, ownerId, projectId);
          break;
        case "output":
          throw new Error("output jobs are enqueued via output routes");
        default:
          throw new Error(`Unknown job kind: ${kind satisfies never}`);
      }
    },
  );
}

export async function startWorker(store: Store): Promise<void> {
  if (!isQueueEnabled()) {
    console.log("[queue] REDIS_URL not set; not starting worker");
    return;
  }

  const { Worker } = await import("bullmq");
  const worker = new Worker(
    "workstream-pipeline",
    async (job) => {
      await runJob(store, job.data as PipelineJobPayload);
    },
    { connection: { url: process.env.REDIS_URL } },
  );

  worker.on("failed", (job, err) => {
    console.error("[queue] job failed", job?.id, err);
  });

  console.log("[queue] BullMQ worker listening on workstream-pipeline");
}
