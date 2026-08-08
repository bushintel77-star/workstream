import { describe, expect, it } from "vitest";
import { unlockedModes } from "./canvas-mode";
import { lockReasonForMode, MODE_LOCK_COPY } from "./modeLockCopy";

describe("modeLockCopy", () => {
  it("matches Tier-1 2026 lock strings for gated modes", () => {
    const open = unlockedModes({
      hasAerial: false,
      hasSketch: false,
      hasCad: false,
      hasQuote: false,
    });
    expect(lockReasonForMode("sketch", open)).toBe(MODE_LOCK_COPY.surveyGate);
    expect(lockReasonForMode("cad", open)).toBe(MODE_LOCK_COPY.surveyGate);
    expect(lockReasonForMode("elevation", open)).toBe(MODE_LOCK_COPY.surveyGate);
    expect(lockReasonForMode("quote", open)).toBe(MODE_LOCK_COPY.quoteGate);
    expect(lockReasonForMode("present", open)).toBe(MODE_LOCK_COPY.presentGate);
    expect(lockReasonForMode("share", open)).toBe(MODE_LOCK_COPY.shareGate);
    expect(lockReasonForMode("survey", open)).toBeNull();
  });

  it("clears quote lock after CAD accept progress", () => {
    const open = unlockedModes({
      hasAerial: true,
      hasSketch: true,
      hasCad: true,
      hasQuote: false,
    });
    expect(lockReasonForMode("quote", open)).toBeNull();
    expect(lockReasonForMode("share", open)).toBe(MODE_LOCK_COPY.shareGate);
  });
});
