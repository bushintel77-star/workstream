import { describe, expect, it } from "vitest";
import { classifySaveError } from "./saveDesignCanvasClient";

describe("classifySaveError", () => {
  it("detects Next.js stale Server Action after deploy", () => {
    expect(
      classifySaveError(
        new Error(
          'Failed to find Server Action "abc". This request might be from an older or newer deployment.',
        ),
      ),
    ).toBe("stale_client");
  });

  it("detects unreachable network failures", () => {
    expect(
      classifySaveError(new Error("Couldn't reach the server: fetch failed")),
    ).toBe("unreachable");
    expect(classifySaveError(new Error("Failed to fetch"))).toBe("unreachable");
  });

  it("treats validation / 400 copy as rejected", () => {
    expect(
      classifySaveError(new Error("Site plan failed validation")),
    ).toBe("rejected");
  });

  it("does not treat a generic wrap as unreachable (preserve original err)", () => {
    // Regression: saveNow used to rethrow "Design canvas save failed", which
    // made every retry look like a server rejection.
    expect(
      classifySaveError(new Error("Design canvas save failed")),
    ).toBe("rejected");
    expect(
      classifySaveError(
        new Error("Couldn't reach the server: ECONNREFUSED"),
      ),
    ).toBe("unreachable");
  });
});
