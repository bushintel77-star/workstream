import type { StudioMode, StudioTool } from "../../studioCatalog";
import { pointerMarkCursor, type PointerMarkId } from "./pointerMarks";

export type StudioCursorContext = {
  /** Personal garden mark (settings). Used when drafting / idle. */
  markId: PointerMarkId;
  tool: StudioTool | string;
  mode: StudioMode;
  locked: boolean;
  /** Fit sheet / paper — default arrow, not craft mark. */
  frameOn?: boolean;
  /** Board reports drag / insert affordance while editing. */
  boardCursor?: "default" | "move" | "add" | "paint" | null;
};

/**
 * Context-aware canvas cursor — function follows environment, mark is idle craft.
 *
 * Precision tools → crosshair; paint → cell; place → copy; drag → grab;
 * lock → not-allowed; otherwise the personal garden mark.
 */
export function resolveStudioCursor(ctx: StudioCursorContext): string {
  if (ctx.frameOn) return "default";

  if (ctx.boardCursor === "move") return "grab";
  if (ctx.boardCursor === "add") return "copy";
  if (ctx.boardCursor === "paint") return "cell";

  const tool = ctx.tool;

  if (
    tool === "measure" ||
    tool === "trace" ||
    tool === "sketch" ||
    tool === "zone" ||
    tool === "calib" ||
    tool === "level" ||
    tool === "service"
  ) {
    return "crosshair";
  }

  if (tool === "paint") return "cell";
  if (tool === "add") return "copy";
  if (tool === "lock" || (ctx.locked && tool === "edit")) return "not-allowed";
  if (tool === "pan") return "grab";

  /* Idle edit / default drafting — personal mark. */
  return pointerMarkCursor(ctx.markId);
}
