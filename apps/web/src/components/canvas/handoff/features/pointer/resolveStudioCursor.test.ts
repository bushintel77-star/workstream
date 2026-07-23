import { describe, expect, it } from "vitest";
import { resolveStudioCursor } from "./resolveStudioCursor";

describe("resolveStudioCursor", () => {
  it("uses the garden mark when idle in Select", () => {
    const cur = resolveStudioCursor({
      markId: "spade",
      tool: "select",
      mode: "cad",
      locked: false,
    });
    expect(cur).toContain("data:image/svg+xml");
  });

  it("switches function by tool environment", () => {
    expect(
      resolveStudioCursor({
        markId: "spade",
        tool: "measure",
        mode: "cad",
        locked: false,
      }),
    ).toBe("crosshair");
    const sketch = resolveStudioCursor({
      markId: "spade",
      tool: "sketch",
      mode: "sketch",
      locked: false,
      sketchTip: "fine",
    });
    expect(sketch).toContain("data:image/svg+xml");
    const eraser = resolveStudioCursor({
      markId: "spade",
      tool: "sketch",
      mode: "sketch",
      locked: false,
      sketchTool: "eraser",
    });
    expect(eraser).toContain("data:image/svg+xml");
    expect(eraser).toContain("cell");
    const paint = resolveStudioCursor({
      markId: "spade",
      tool: "paint",
      mode: "cad",
      locked: false,
    });
    expect(paint).toContain("data:image/svg+xml");
    expect(paint).toContain("crosshair");
    expect(
      resolveStudioCursor({
        markId: "spade",
        tool: "add",
        mode: "cad",
        locked: false,
      }),
    ).toBe("copy");
    // Select in sketch mode keeps the mark — the pen cursor is only for the armed pen.
    const sketchSelect = resolveStudioCursor({
      markId: "spade",
      tool: "select",
      mode: "sketch",
      locked: false,
      sketchTool: "pen",
      sketchTip: "medium",
    });
    expect(sketchSelect).toContain("data:image/svg+xml");
  });

  it("rule 1 — an armed tool's cursor is identical over objects and empty board", () => {
    for (const tool of [
      "trace",
      "measure",
      "zone",
      "calib",
      "level",
      "service",
      "add",
      "paint",
    ] as const) {
      const empty = resolveStudioCursor({
        markId: "spade",
        tool,
        mode: "cad",
        locked: false,
      });
      const overObject = resolveStudioCursor({
        markId: "spade",
        tool,
        mode: "cad",
        locked: false,
        boardCursor: "move",
      });
      expect(overObject).toBe(empty);
    }
  });

  it("rule 5 — Lock shows a pointer with a lock badge, never not-allowed", () => {
    const lock = resolveStudioCursor({
      markId: "spade",
      tool: "lock",
      mode: "cad",
      locked: true,
    });
    expect(lock).not.toBe("not-allowed");
    expect(lock).toContain("data:image/svg+xml");
  });

  it("Select closes to the grab hand over a draggable object", () => {
    expect(
      resolveStudioCursor({
        markId: "fork",
        tool: "select",
        mode: "cad",
        locked: false,
        boardCursor: "move",
      }),
    ).toBe("grab");
  });

  it("uses default on the fit sheet", () => {
    expect(
      resolveStudioCursor({
        markId: "spade",
        tool: "select",
        mode: "cad",
        locked: false,
        frameOn: true,
      }),
    ).toBe("default");
  });
});
