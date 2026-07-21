import type { StudioTool } from "../../studioCatalog";

/** Idle "Select" tool — Esc always returns here. */
export const SELECT_TOOL: StudioTool = "pan";

export type ToolStack = {
  current: StudioTool;
  previous: StudioTool;
};

/**
 * Two-slot tool memory (AutoCAD-style). `record` remembers the tool you left
 * so Q can flip back to it; `toggle` swaps current↔previous.
 */
export function recordTool(stack: ToolStack, next: StudioTool): ToolStack {
  if (next === stack.current) return stack;
  return { current: next, previous: stack.current };
}

export function toggleTool(stack: ToolStack): StudioTool {
  // Never toggle "back" into the idle Select slot — Q is for real tools.
  if (stack.previous === stack.current) return stack.current;
  return stack.previous;
}

/** Esc returns to Select without replacing the real previous tool. */
export function cancelToSelect(stack: ToolStack): ToolStack {
  return { current: SELECT_TOOL, previous: stack.previous };
}
