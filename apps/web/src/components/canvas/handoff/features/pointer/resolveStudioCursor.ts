import type { StudioMode, StudioTool } from "../../studioCatalog";
import { PALETTE } from "../../../../../styles/colorTokens";
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
  /** Tilt lens — grab hand; left-drag pans the drawing. */
  tiltViewActive?: boolean;
  /** Board reports drag / insert affordance while editing. */
  boardCursor?: "default" | "move" | "add" | "paint" | null;
  /** Sketch pad — pen tip grade / eraser (single cursor authority). */
  sketchTool?: "pen" | "eraser";
  sketchTip?: SketchTipGrade;
};

/**
 * Pointer with a lock badge — Lock permits selection (no move), so the cursor
 * must never claim the click does nothing (`not-allowed` lies; rule 5).
 */
export function lockBadgeCursor(): string {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
      `<path d="M5 3l6 14 2.2-5.4L18.6 9.4Z" fill="${PALETTE.grayL900}" stroke="${PALETTE.grayL50}" stroke-width="1"/>` +
      `<rect x="14" y="15" width="8" height="6.5" rx="1.2" fill="${PALETTE.grayL50}" stroke="${PALETTE.grayL900}" stroke-width="1.2"/>` +
      `<path d="M15.8 15v-1.6a2.2 2.2 0 0 1 4.4 0V15" fill="none" stroke="${PALETTE.grayL900}" stroke-width="1.2"/>` +
      `</svg>`,
  );
  return `url("data:image/svg+xml,${svg}") 5 3, default`;
}

/** Low-opacity ink-faint crosshair for Paint air-lock. */
export function paintAirLockCursor(): string {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
      `<line x1="16" y1="3" x2="16" y2="29" stroke="${PALETTE.grayL400}" stroke-opacity="0.55" stroke-width="1"/>` +
      `<line x1="3" y1="16" x2="29" y2="16" stroke="${PALETTE.grayL400}" stroke-opacity="0.55" stroke-width="1"/>` +
      `<circle cx="16" cy="16" r="2.2" fill="none" stroke="${PALETTE.grayL400}" stroke-opacity="0.4" stroke-width="1"/>` +
      `</svg>`,
  );
  return `url("data:image/svg+xml,${svg}") 16 16, crosshair`;
}

/**
 * Context-aware canvas cursor — single authority for zoom world + sketch pad.
 *
 * Rule 1 (docs/INTERACTION-LOGIC.md): the cursor is a pure function of
 * (tool, hover-target, locked) and always predicts the outcome. An armed tool
 * returns its draw cursor unconditionally — even over objects. Only Select
 * (the ground state) reacts to the hover target, closing to the grab hand
 * over a draggable object.
 */
export function resolveStudioCursor(ctx: StudioCursorContext): string {
  if (ctx.frameOn) return "default";
  if (ctx.tiltViewActive) return "grab";

  const tool = ctx.tool;

  if (tool === "paint" || ctx.boardCursor === "paint") {
    return paintAirLockCursor();
  }

  /* Pen cursor only while the pen owns the click — Select in sketch grabs. */
  if (tool === "sketch") {
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
  /* Lock selects but never moves — pointer + badge, never `not-allowed`. */
  if (tool === "lock" || ctx.locked) return lockBadgeCursor();

  /*
   * Select ground state. On the sketch pad a Select-drag pans the camera
   * (nothing to marquee), so the honest cursor is the grab hand. On plan
   * boards: grab hand over a draggable, craft mark when idle.
   */
  if (ctx.mode === "sketch") return "grab";
  if (ctx.boardCursor === "move") return "grab";
  if (ctx.boardCursor === "add") return "copy";
  return pointerMarkCursor(ctx.markId);
}
