import { Worker } from "bullmq";
import { processPipeline } from "./pipeline";

const connection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};

const worker = new Worker("pipeline", processPipeline, {
  connection,
  concurrency: 1,
});

worker.on("ready", () => {
  console.log("Worker started");
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

async function shutdown() {
  console.log("Shutting down worker…");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
