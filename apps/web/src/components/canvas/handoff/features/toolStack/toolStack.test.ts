import { describe, expect, it } from "vitest";
import {
  cancelToSelect,
  recordTool,
  toggleTool,
  type ToolStack,
} from "./toolStack";

describe("toolStack", () => {
  it("remembers the tool you left when switching", () => {
    let stack: ToolStack = { current: "pan", previous: "pan" };
    stack = recordTool(stack, "trace");
    expect(stack).toEqual({ current: "trace", previous: "pan" });
    stack = recordTool(stack, "add");
    expect(stack).toEqual({ current: "add", previous: "trace" });
  });

  it("ignores no-op records to the same tool", () => {
    const stack: ToolStack = { current: "edit", previous: "pan" };
    expect(recordTool(stack, "edit")).toBe(stack);
  });

  it("toggles current <-> previous", () => {
    const stack: ToolStack = { current: "add", previous: "trace" };
    expect(toggleTool(stack)).toBe("trace");
  });

  it("does not toggle when there is no distinct previous tool", () => {
    const stack: ToolStack = { current: "pan", previous: "pan" };
    expect(toggleTool(stack)).toBe("pan");
  });

  it("returns to Select without replacing the previous real tool", () => {
    const stack: ToolStack = { current: "measure", previous: "trace" };
    expect(cancelToSelect(stack)).toEqual({
      current: "pan",
      previous: "trace",
    });
  });
});
