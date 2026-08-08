import { estimateStudioDrawing } from "@workstream/domain";
import type { StudioEstimateReport } from "@workstream/domain";
import type {
  StudioEstimateArgs,
  StudioEstimateWorkerRequest,
  StudioEstimateWorkerResponse,
} from "./studio-estimate-worker-types";

let worker: Worker | null = null;
let seq = 0;

function getWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }
  if (!worker) {
    worker = new Worker(
      new URL("../workers/studio-estimate.worker.ts", import.meta.url),
    );
  }
  return worker;
}

/** Parametric studio BOM off the main thread when Workers are available. */
export function estimateStudioInWorker(
  args: StudioEstimateArgs,
): Promise<StudioEstimateReport> {
  const w = getWorker();
  if (!w) {
    return Promise.resolve(estimateStudioDrawing(args));
  }

  const requestId = `est_${++seq}_${Date.now()}`;
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<StudioEstimateWorkerResponse>) => {
      const data = event.data;
      if (
        !data ||
        data.type !== "estimate_studio_result" ||
        data.requestId !== requestId
      ) {
        return;
      }
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      resolve(data.report);
    };
    const onError = (err: ErrorEvent) => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      reject(err.error ?? new Error(err.message || "Studio estimate worker failed"));
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    const req: StudioEstimateWorkerRequest = {
      type: "estimate_studio",
      requestId,
      args,
    };
    w.postMessage(req);
  });
}
