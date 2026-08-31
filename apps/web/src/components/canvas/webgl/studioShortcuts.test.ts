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
    expect(keys).toContain("?");
    expect(keys).toContain("Ctrl+K");
  });
});
