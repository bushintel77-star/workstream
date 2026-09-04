import { describe, expect, it } from "vitest";
import {
  SHORTCUT_ROWS,
  resolveStudioShortcut,
} from "./studioShortcuts";

function key(
  k: string,
  init: Partial<KeyboardEvent> = {},
): KeyboardEvent {
  return {
    key: k,
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: { tagName: "DIV", isContentEditable: false },
    ...init,
  } as KeyboardEvent;
}

describe("resolveStudioShortcut", () => {
  it("maps 1–4 to camera dock presets (handoff §6.1)", () => {
    expect(resolveStudioShortcut(key("1"))).toEqual({
      kind: "viewport",
      preset: "plan",
    });
    expect(resolveStudioShortcut(key("2"))).toEqual({
      kind: "viewport",
      preset: "axo",
    });
    expect(resolveStudioShortcut(key("3"))).toEqual({
      kind: "viewport",
      preset: "sec",
    });
    expect(resolveStudioShortcut(key("4"))).toEqual({
      kind: "viewport",
      preset: "3d",
    });
  });

  it("maps Shift+1–8 to canvas modes without stealing viewport keys", () => {
    expect(resolveStudioShortcut(key("1", { shiftKey: true }))).toEqual({
      kind: "mode",
      mode: "survey",
    });
    expect(resolveStudioShortcut(key("2", { shiftKey: true }))).toEqual({
      kind: "mode",
      mode: "sketch",
    });
    expect(resolveStudioShortcut(key("6", { shiftKey: true }))).toEqual({
      kind: "mode",
      mode: "quote",
    });
  });

  it("maps letter tools and ? help", () => {
    expect(resolveStudioShortcut(key("a"))).toEqual({
      kind: "tool",
      tool: "assets",
    });
    expect(resolveStudioShortcut(key("M"))).toEqual({
      kind: "tool",
      tool: "measure",
    });
    expect(resolveStudioShortcut(key("?"))).toEqual({
      kind: "tool",
      tool: "help",
    });
    expect(resolveStudioShortcut(key("/", { shiftKey: true }))).toEqual({
      kind: "tool",
      tool: "help",
    });
  });

  it("maps P/L/S/C/G to the ribbon tools (handoff §5.1)", () => {
    expect(resolveStudioShortcut(key("p"))).toEqual({
      kind: "ribbon-tool",
      tool: "pen",
    });
    expect(resolveStudioShortcut(key("L"))).toEqual({
      kind: "ribbon-tool",
      tool: "line",
    });
    expect(resolveStudioShortcut(key("s"))).toEqual({
      kind: "ribbon-tool",
      tool: "spline",
    });
    expect(resolveStudioShortcut(key("c"))).toEqual({
      kind: "ribbon-tool",
      tool: "contour",
    });
    expect(resolveStudioShortcut(key("G"))).toEqual({
      kind: "ribbon-tool",
      tool: "slope",
    });
  });

  it("reserves H for the hold-peek and never steals it from the ribbon", () => {
    expect(resolveStudioShortcut(key("h"))).toBeNull();
    expect(resolveStudioShortcut(key("H"))).toBeNull();
  });

  it("ignores typing targets and modifier chords (Ctrl+K stays the palette)", () => {
    expect(
      resolveStudioShortcut(
        key("1", {
          target: { tagName: "INPUT", isContentEditable: false } as unknown as EventTarget,
        }),
      ),
    ).toBeNull();
    expect(resolveStudioShortcut(key("k", { ctrlKey: true }))).toBeNull();
  });

  it("documents every bound key in the help rows", () => {
    const keys = SHORTCUT_ROWS.map((r) => r.keys);
    expect(keys).toContain("1");
    expect(keys).toContain("Shift+2");
    expect(keys).toContain("A");
    expect(keys).toContain("P / B");
    expect(keys).toContain("L");
    expect(keys).toContain("S");
    expect(keys).toContain("C");
    expect(keys).toContain("G");
    expect(keys).toContain("?");
    expect(keys).toContain("Ctrl+K");
  });
});

describe("Tier-1 brush keys (§2.3)", () => {
  it("maps E eraser, [ ] size, X colour swap", () => {
    expect(resolveStudioShortcut(key("e"))).toEqual({
      kind: "brush",
      action: "eraser",
    });
    expect(resolveStudioShortcut(key("["))).toEqual({
      kind: "brush",
      action: "size-down",
    });
    expect(resolveStudioShortcut(key("]"))).toEqual({
      kind: "brush",
      action: "size-up",
    });
    expect(resolveStudioShortcut(key("x"))).toEqual({
      kind: "brush",
      action: "swap-colour",
    });
  });

  it("keeps B as a pen alias and ignores shifted variants", () => {
    expect(resolveStudioShortcut(key("b"))).toEqual({
      kind: "ribbon-tool",
      tool: "pen",
    });
    // Shift+[ is "{" on US layouts — not a brush key.
    expect(resolveStudioShortcut(key("[", { shiftKey: true }))).toBeNull();
    expect(resolveStudioShortcut(key("e", { shiftKey: true }))).toBeNull();
  });

  it("documents the brush keys in the help rows", () => {
    const keys = SHORTCUT_ROWS.map((r) => r.keys);
    expect(keys).toContain("E");
    expect(keys).toContain("[ / ]");
    expect(keys).toContain("X");
    expect(keys).toContain("P / B");
  });
});
