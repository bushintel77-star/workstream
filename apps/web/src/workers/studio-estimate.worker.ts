/// <reference lib="webworker" />

import { estimateStudioDrawing } from "@workstream/domain";
import type {
  StudioEstimateWorkerRequest,
  StudioEstimateWorkerResponse,
} from "../lib/studio-estimate-worker-types";

/**
 * Off-main-thread parametric BOM for the WebGL studio.
 * Keeps the UI fluid while excavation / CR6 / edge restraint recompute.
 */
const ctx: DedicatedWorkerGlobalScope =
  self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<StudioEstimateWorkerRequest>) => {
  const msg = event.data;
  if (!msg || msg.type !== "estimate_studio") return;
  const report = estimateStudioDrawing(msg.args);
  const response: StudioEstimateWorkerResponse = {
    type: "estimate_studio_result",
    requestId: msg.requestId,
    report,
  };
  ctx.postMessage(response);
};

export {};
