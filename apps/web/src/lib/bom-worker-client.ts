import type { RateCard, SpatialObject } from "@workstream/contracts";
import type {
  BomWorkerRequest,
  BomWorkerResponse,
  ExpandBomResult,
} from "./bom-worker-types";

let worker: Worker | null = null;
let seq = 0;

function getWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }
  if (!worker) {
    worker = new Worker(new URL("../workers/bom.worker.ts", import.meta.url));
  }
  return worker;
}

/** Expand preemptive BOM off the main thread when Workers are available. */
export function expandBomInWorker(
  spatial_facts: SpatialObject[],
  rate_card?: RateCard[],
): Promise<ExpandBomResult> {
  const w = getWorker();
  if (!w) {
    return import("@workstream/domain").then(
      ({ expandPreemptiveBom, bomTotals, DEFAULT_SITE_MULTIPLIERS }) => {
        const lines = expandPreemptiveBom(
          spatial_facts,
          rate_card ?? [],
          DEFAULT_SITE_MULTIPLIERS,
        );
        return { lines, totals: bomTotals(lines) };
      },
    );
  }

  const requestId = `bom_${++seq}_${Date.now()}`;
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<BomWorkerResponse>) => {
      const data = event.data;
      if (!data || data.type !== "expand_result" || data.requestId !== requestId) {
        return;
      }
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      resolve({ lines: data.lines, totals: data.totals });
    };
    const onError = (err: ErrorEvent) => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      reject(err.error ?? new Error(err.message || "BOM worker failed"));
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    const req: BomWorkerRequest = {
      type: "expand",
      requestId,
      spatial_facts,
      rate_card,
    };
    w.postMessage(req);
  });
}

export type { ExpandBomResult };
