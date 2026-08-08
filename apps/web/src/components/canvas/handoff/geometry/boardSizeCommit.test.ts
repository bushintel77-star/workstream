import { describe, expect, it } from "vitest";
import {
  fitSeedBoardKey,
  nextBoardSize,
  roundBoardSizeCssPx,
} from "./boardSizeCommit";

describe("boardSizeCommit (CSS px — DPR-invariant)", () => {
  it("rounds to integer CSS pixels", () => {
    expect(roundBoardSizeCssPx(960.4, 640.6)).toEqual({ w: 960, h: 641 });
    expect(roundBoardSizeCssPx(960.5, 640.5)).toEqual({ w: 961, h: 641 });
  });

  it("swallows sub-pixel RO noise that would thrash Fit-seed keys", () => {
    const prev = { w: 960, h: 640 };
    // Typical high-DPI fractional CSS noise around the same layout box
    expect(nextBoardSize(prev, 960.1, 640.1)).toBeNull();
    expect(nextBoardSize(prev, 960.4, 640.4)).toBeNull();
    expect(nextBoardSize(prev, 959.6, 639.6)).toBeNull();

    const key = fitSeedBoardKey("a3", 100, prev);
    expect(fitSeedBoardKey("a3", 100, roundBoardSizeCssPx(960.4, 640.4))).toBe(
      key,
    );
  });

  it("does not swallow a real ≥0.5 CSS-px resize (Fit-on re-seed must fire)", () => {
    const prev = { w: 960, h: 640 };
    // Half-pixel up → new integer → Fit seed key must change
    expect(nextBoardSize(prev, 960.5, 640)).toEqual({ w: 961, h: 640 });
    expect(nextBoardSize(prev, 960, 641)).toEqual({ w: 960, h: 641 });
    expect(nextBoardSize(prev, 1200, 800)).toEqual({ w: 1200, h: 800 });

    const before = fitSeedBoardKey("a3", 100, prev);
    const after = fitSeedBoardKey(
      "a3",
      100,
      nextBoardSize(prev, 960.5, 640)!,
    );
    expect(after).not.toBe(before);
  });

  it("treats measurements as CSS px (DPR does not scale the unit)", () => {
    // Simulate: layout is 1100×720 CSS px whether DPR is 1 or 2.5.
    // Device pixels would be 2750×1800 at DPR 2.5 — we must NOT see those.
    const cssW = 1100;
    const cssH = 720;
    const dpr = 2.5;
    const deviceW = cssW * dpr;
    const deviceH = cssH * dpr;

    expect(roundBoardSizeCssPx(cssW, cssH)).toEqual({ w: 1100, h: 720 });
    // Guard against accidentally feeding device pixels into commitSize
    expect(roundBoardSizeCssPx(deviceW, deviceH)).not.toEqual({
      w: 1100,
      h: 720,
    });
    expect(deviceW).toBeGreaterThan(2000);
  });
});
