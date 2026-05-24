import { describe, expect, it } from "vitest";
import {
  getIdempotentPipelineResponse,
  pipelineIdempotencyKey,
  readIdempotencyHeader,
  setIdempotentPipelineResponse,
} from "./pipeline-idempotency";

describe("pipeline-idempotency", () => {
  it("returns cached 202 body for the same key", () => {
    const key = pipelineIdempotencyKey("owner", "proj", "abc");
    setIdempotentPipelineResponse(key, { accepted: true, queued: true });
    expect(getIdempotentPipelineResponse(key)).toEqual({
      accepted: true,
      queued: true,
    });
  });

  it("parses idempotency header", () => {
    expect(readIdempotencyHeader("  run-1  ")).toBe("run-1");
    expect(readIdempotencyHeader(undefined)).toBeNull();
  });
});
