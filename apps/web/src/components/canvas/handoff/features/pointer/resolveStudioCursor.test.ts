import { describe, expect, it } from "vitest";
import { resolveStudioCursor } from "./resolveStudioCursor";

describe("resolveStudioCursor", () => {
  it("uses the garden mark when idle drafting", () => {
    const cur = resolveStudioCursor({
      markId: "spade",
      tool: "edit",
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
    expect(
      resolveStudioCursor({
        markId: "spade",
        tool: "pan",
        mode: "cad",
        locked: false,
      }),
    ).toBe("grab");
    // Pan in sketch mode grabs — the pen cursor is only for the armed pen.
    expect(
      resolveStudioCursor({
        markId: "spade",
        tool: "pan",
        mode: "sketch",
        locked: false,
        sketchTool: "pen",
        sketchTip: "medium",
      }),
    ).toBe("grab");
    expect(
      resolveStudioCursor({
        markId: "spade",
        tool: "lock",
        mode: "cad",
        locked: true,
      }),
    ).toBe("not-allowed");
  });

  it("honours board drag affordance over the idle mark", () => {
    expect(
      resolveStudioCursor({
        markId: "fork",
        tool: "edit",
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
        tool: "edit",
        mode: "cad",
        locked: false,
        frameOn: true,
      }),
    ).toBe("default");
  });
});
