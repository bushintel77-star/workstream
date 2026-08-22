import { describe, expect, it } from "vitest";
import { unlockedModes } from "./canvas-mode";
import { lockReasonForMode, modeLockAction, MODE_LOCK_COPY } from "./modeLockCopy";

describe("mode lock copy", () => {
  it("returns actionable survey prerequisite metadata", () => {
    const open = unlockedModes({ hasAerial: false, hasSketch: false, hasCad: false, hasQuote: false });
    expect(modeLockAction("cad", open)).toEqual({
      reason: MODE_LOCK_COPY.surveyGate,
      destination: "survey",
      actionLabel: "Open Survey",
    });
  });

  it("routes quote and share locks to their prerequisites", () => {
    const open = unlockedModes({ hasAerial: true, hasSketch: true, hasCad: false, hasQuote: false });
    expect(modeLockAction("quote", open)?.destination).toBe("cad");
    expect(modeLockAction("share", open)?.destination).toBe("quote");
  });

  it("keeps the existing reason API stable", () => {
    const open = unlockedModes({ hasAerial: false, hasSketch: false, hasCad: false, hasQuote: false });
    expect(lockReasonForMode("sketch", open)).toBe(MODE_LOCK_COPY.surveyGate);
    expect(lockReasonForMode("survey", open)).toBeNull();
  });
});
