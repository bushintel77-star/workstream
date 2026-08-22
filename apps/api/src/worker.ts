/**
 * Optional BullMQ worker process. Enable by setting REDIS_URL and running:
 *
 *   node dist/worker.js
 *
 * On Fly, add a `[processes] worker = "node dist/worker.js"` entry once Redis
 * is provisioned (Upstash or Fly Redis).
 */
import { loadEnv } from "./env";
import { assertAuthConfigured } from "./lib/auth-config";
import { initStore } from "@workstream/db";
import { startWorker, stopWorker } from "./lib/queue";
import { initTelemetry, shutdownTelemetry } from "./lib/telemetry";

async function main(): Promise<void> {
  loadEnv({
    warn: (m) => console.warn(m),
    error: (m) => console.error(m),
  });
  initTelemetry();
  assertAuthConfigured();

  const store = await initStore();
  await startWorker(store);
  console.log("[worker] pipeline worker running");
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`[worker] ${signal} received; closing worker + telemetry`);
  await stopWorker();
  await shutdownTelemetry();
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
