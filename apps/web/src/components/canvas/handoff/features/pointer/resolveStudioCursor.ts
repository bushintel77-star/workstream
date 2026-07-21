import type { StudioMode, StudioTool } from "../../studioCatalog";
import {
  sketchEraserCursor,
  sketchPenCursor,
  type SketchTipGrade,
} from "../sketch/sketchCursors";
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
  /** Sketch pad — pen tip grade / eraser (single cursor authority). */
  sketchTool?: "pen" | "eraser";
  sketchTip?: SketchTipGrade;
};

/** Low-opacity ink-faint crosshair for Paint air-lock. */
export function paintAirLockCursor(): string {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
      `<line x1="16" y1="3" x2="16" y2="29" stroke="#B08A95" stroke-opacity="0.55" stroke-width="1"/>` +
      `<line x1="3" y1="16" x2="29" y2="16" stroke="#B08A95" stroke-opacity="0.55" stroke-width="1"/>` +
      `<circle cx="16" cy="16" r="2.2" fill="none" stroke="#B08A95" stroke-opacity="0.4" stroke-width="1"/>` +
      `</svg>`,
  );
  return `url("data:image/svg+xml,${svg}") 16 16, crosshair`;
}

/**
 * Context-aware canvas cursor — function follows environment, mark is idle craft.
 * Single authority for zoom world + sketch pad (no competing CSS cursors).
 */
export function resolveStudioCursor(ctx: StudioCursorContext): string {
  if (ctx.frameOn) return "default";

  if (ctx.boardCursor === "move") return "grab";
  if (ctx.boardCursor === "add") return "copy";

  const tool = ctx.tool;

  if (tool === "paint" || ctx.boardCursor === "paint") {
    return paintAirLockCursor();
  }

  if (tool === "sketch" || ctx.mode === "sketch") {
    if (ctx.sketchTool === "eraser") return sketchEraserCursor();
    return sketchPenCursor(ctx.sketchTip ?? "medium");
  }

  if (
    tool === "measure" ||
    tool === "trace" ||
    tool === "zone" ||
    tool === "calib" ||
    tool === "level" ||
    tool === "service"
  ) {
    return "crosshair";
  }

  if (tool === "add") return "copy";
  if (tool === "lock" || (ctx.locked && tool === "edit")) return "not-allowed";
  if (tool === "pan") return "grab";

  return pointerMarkCursor(ctx.markId);
}
