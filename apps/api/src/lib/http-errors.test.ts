import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import { internalErrorBody, publicServerError } from "./http-errors";

describe("http-errors", () => {
  it("never echoes internal exception text for 5xx bodies", () => {
    expect(publicServerError(new Error("ECONNREFUSED 10.0.0.1:5432"), "Design failed")).toBe(
      "Design failed",
    );
    expect(internalErrorBody("abc-123")).toEqual({
      error: "Internal error",
      requestId: "abc-123",
    });
  });

  it("ZodError remains distinguishable for the global handler", () => {
    const parsed = z.object({ address: z.string().min(5) }).safeParse({ address: "x" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error).toBeInstanceOf(ZodError);
  });
});
