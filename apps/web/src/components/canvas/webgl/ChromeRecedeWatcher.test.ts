import { describe, expect, it } from "vitest";
import { REST_LINGER_MS, recedeState } from "./ChromeRecedeWatcher";
import { useStudioStore } from "./studioStore";

describe("recedeState (pure flip logic)", () => {
  it("recedes while moving and lingers REST_LINGER_MS after the last moving frame", () => {
    expect(recedeState(true, 1_000, 1_000)).toBe(true);
    expect(recedeState(false, 1_000 + REST_LINGER_MS - 1, 1_000)).toBe(true);
    expect(recedeState(false, 1_000 + REST_LINGER_MS, 1_000)).toBe(false);
  });

  it("first frame with no history does not recede", () => {
    // performance.now() is far past the linger window on the first frame,
    // and lastMoveAt starts at 0 — so a still camera starts unreceded.
    expect(recedeState(false, 10_000, 0)).toBe(false);
  });
});

describe("studioStore chrome recede flags", () => {
  it("setChromeReceded / setChromePeek flip and reset", () => {
    const s = useStudioStore.getState();
    const beforeReceded = s.chromeReceded;
    const beforePeek = s.chromePeek;
    try {
      s.setChromeReceded(true);
      s.setChromePeek(true);
      expect(useStudioStore.getState().chromeReceded).toBe(true);
      expect(useStudioStore.getState().chromePeek).toBe(true);
      s.setChromeReceded(false);
      s.setChromePeek(false);
      expect(useStudioStore.getState().chromeReceded).toBe(false);
      expect(useStudioStore.getState().chromePeek).toBe(false);
    } finally {
      useStudioStore.getState().setChromeReceded(beforeReceded);
      useStudioStore.getState().setChromePeek(beforePeek);
    }
  });
});
