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
 *
 * Precision tools → crosshair; paint → air-lock faint crosshair; place → copy;
 * drag → grab; lock → not-allowed; otherwise the personal garden mark.
 */
export function resolveStudioCursor(ctx: StudioCursorContext): string {
  if (ctx.frameOn) return "default";

  if (ctx.boardCursor === "move") return "grab";
  if (ctx.boardCursor === "add") return "copy";

  const tool = ctx.tool;

  if (tool === "paint" || ctx.boardCursor === "paint") {
    return paintAirLockCursor();
  }

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

  if (tool === "add") return "copy";
  if (tool === "lock" || (ctx.locked && tool === "edit")) return "not-allowed";
  if (tool === "pan") return "grab";

  /* Idle edit / default drafting — personal mark. */
  return pointerMarkCursor(ctx.markId);
}
