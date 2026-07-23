import { describe, expect, it } from "vitest";
import {
  DEFAULT_FADE,
  fadeInteractive,
  fadeOpacity,
  fadeReduce,
  HIDDEN_FADE,
  type FadeState,
} from "./transientFade";

const at = (state: FadeState, kind: Parameters<typeof fadeReduce>[1]["kind"], now: number) =>
  fadeReduce(state, { kind, now } as Parameters<typeof fadeReduce>[1]);

describe("transient fade machine", () => {
  it("summon → visible at full opacity", () => {
    const s = at(HIDDEN_FADE, "summon", 1000);
    expect(s.phase).toBe("visible");
    expect(fadeOpacity(s)).toBe(1);
    expect(fadeInteractive(s)).toBe(true);
  });

  it("idles into prefade (60%) then hidden", () => {
    let s = at(HIDDEN_FADE, "summon", 0);
    s = at(s, "tick", DEFAULT_FADE.idleMs - 1);
    expect(s.phase).toBe("visible");
    s = at(s, "tick", DEFAULT_FADE.idleMs);
    expect(s.phase).toBe("prefade");
    expect(fadeOpacity(s)).toBe(0.6);
    s = at(s, "tick", DEFAULT_FADE.idleMs + DEFAULT_FADE.prefadeMs);
    expect(s.phase).toBe("hidden");
    expect(fadeOpacity(s)).toBe(0);
    expect(fadeInteractive(s)).toBe(false);
  });

  it("a returning pointer catches it mid-prefade (the forgiving fade)", () => {
    let s = at(HIDDEN_FADE, "summon", 0);
    s = at(s, "tick", DEFAULT_FADE.idleMs); // prefade begins
    expect(s.phase).toBe("prefade");
    s = at(s, "pointer-enter", DEFAULT_FADE.idleMs + 400);
    expect(s.phase).toBe("visible");
    expect(fadeOpacity(s)).toBe(1);
  });

  it("hover blocks the idle clock entirely", () => {
    let s = at(HIDDEN_FADE, "summon", 0);
    s = at(s, "pointer-enter", 100);
    s = at(s, "tick", 60_000);
    expect(s.phase).toBe("visible");
  });

  it("focus-within blocks the idle clock (keyboard users)", () => {
    let s = at(HIDDEN_FADE, "summon", 0);
    s = at(s, "focus-in", 50);
    s = at(s, "tick", 60_000);
    expect(s.phase).toBe("visible");
  });

  it("leaving restarts the idle clock from the leave, not the summon", () => {
    let s = at(HIDDEN_FADE, "summon", 0);
    s = at(s, "pointer-enter", 100);
    s = at(s, "pointer-leave", 10_000);
    s = at(s, "tick", 10_000 + DEFAULT_FADE.idleMs - 1);
    expect(s.phase).toBe("visible");
    s = at(s, "tick", 10_000 + DEFAULT_FADE.idleMs);
    expect(s.phase).toBe("prefade");
  });

  it("escape and choose hide immediately", () => {
    let s = at(HIDDEN_FADE, "summon", 0);
    expect(at(s, "escape", 10).phase).toBe("hidden");
    expect(at(s, "choose", 10).phase).toBe("hidden");
  });

  it("is deterministic — same event sequence, same states", () => {
    const run = () => {
      let s = at(HIDDEN_FADE, "summon", 0);
      s = at(s, "pointer-enter", 200);
      s = at(s, "pointer-leave", 900);
      s = at(s, "tick", 900 + DEFAULT_FADE.idleMs);
      s = at(s, "tick", 900 + DEFAULT_FADE.idleMs + DEFAULT_FADE.prefadeMs);
      return s;
    };
    expect(run()).toEqual(run());
  });
});
