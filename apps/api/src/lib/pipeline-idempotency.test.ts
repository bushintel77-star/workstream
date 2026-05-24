import { afterEach, describe, expect, it } from "vitest";
import {
  getIdempotentPipelineResponse,
  pipelineIdempotencyKey,
  readIdempotencyHeader,
  resetPipelineIdempotencyRedisForTests,
  setIdempotentPipelineResponse,
} from "./pipeline-idempotency";

describe("pipeline-idempotency", () => {
  afterEach(() => {
    resetPipelineIdempotencyRedisForTests();
  });

  it("returns cached 202 body for the same key", async () => {
    const key = pipelineIdempotencyKey("owner", "proj", "abc");
    await setIdempotentPipelineResponse(key, { accepted: true, queued: true });
    await expect(getIdempotentPipelineResponse(key)).resolves.toEqual({
      accepted: true,
      queued: true,
    });
  });

  it("parses idempotency header", () => {
    expect(readIdempotencyHeader("  run-1  ")).toBe("run-1");
    expect(readIdempotencyHeader(undefined)).toBeNull();
  });
});
