/**
 * Compact studio sheet — page + snap helpers (pure, unit-testable).
 */

export type StudioSheetPage = "assets" | "data" | "inbox";

export type StudioSheetSnap = "peek" | "half" | "full";

export const STUDIO_SHEET_PAGES: ReadonlyArray<{
  id: StudioSheetPage;
  label: string;
}> = [
  { id: "assets", label: "Assets" },
  { id: "data", label: "Data" },
  { id: "inbox", label: "Inbox" },
];

/** Peek height reserved into --ws-safe-bottom when sheet is open. */
export const STUDIO_SHEET_PEEK_PX = 72;
export const STUDIO_SHEET_FAB_CLEAR_PX = 64;
/** Compact contextual tool strip + FAB stack. */
export const CONTEXTUAL_STRIP_CLEAR_PX = 112;

export function nextSheetSnap(current: StudioSheetSnap): StudioSheetSnap {
  if (current === "peek") return "half";
  if (current === "half") return "full";
  return "peek";
}

export function sheetSafeBottomPx(args: {
  sheetOpen: boolean;
  fabOn: boolean;
  sunOn: boolean;
  toolStripOn?: boolean;
}): number {
  let n = 36;
  if (args.sheetOpen) n = Math.max(n, STUDIO_SHEET_PEEK_PX + 12);
  if (args.fabOn) n = Math.max(n, STUDIO_SHEET_FAB_CLEAR_PX + 16);
  if (args.toolStripOn) n = Math.max(n, CONTEXTUAL_STRIP_CLEAR_PX);
  if (args.sunOn) n = Math.max(n, 96);
  return n;
}
