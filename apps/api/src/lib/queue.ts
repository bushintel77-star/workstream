/**
 * Pipeline-job queue scaffold. Activates only if REDIS_URL is set; otherwise
 * the existing inline execution path is used (the API does the work in the
 * request handler).
 *
 * To enable async pipeline execution:
 *
 *   1. Provision Redis (Upstash, Redis Cloud, Fly Redis — any).
 *   2. `pnpm --filter @workstream/api add bullmq ioredis`
 *   3. `flyctl secrets set REDIS_URL=rediss://… -a workstream-api`
 *   4. Start a worker process on a separate Fly machine via
 *      `[processes]` in fly.toml — e.g. `worker = "node dist/worker.js"`.
 *      A worker.js wrapper that calls `startWorker()` from this file is
 *      the next thing to write.
 *
 * Until then this file is a no-op safety net.
 */

import type { Store } from "@workstream/db";

type JobKind = "survey" | "design" | "costing" | "audit" | "output";

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

/**
 * Worker entrypoint — wire this into `worker.js` once bullmq is installed
 * and a Fly worker process is configured.
 */
export async function startWorker(_store: Store): Promise<void> {
  if (!isQueueEnabled()) {
    console.log("[queue] REDIS_URL not set; not starting worker");
    return;
  }
  console.log("[queue] worker scaffold present — install bullmq to enable");
}
