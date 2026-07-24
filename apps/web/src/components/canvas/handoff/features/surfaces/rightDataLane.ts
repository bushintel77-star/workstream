/**
 * Right data lane — one summoned panel at a time (lane law, STUDIO-SURFACES §17).
 * Left lane is the tool tray only. Do not anchor other chrome left.
 */

export type RightDataPanel =
  | "layers"
  | "measures"
  | "sites"
  | "checklist"
  | "services"
  | "environment";

/** Nominal panel width reserved into `--ws-safe-right` while a panel is open. */
export const RIGHT_DATA_LANE_WIDTH_PX = 304;

export function toggleRightDataPanel(
  current: RightDataPanel | null,
  next: RightDataPanel,
): RightDataPanel | null {
  return current === next ? null : next;
}

export function rightDataPanelOpen(
  current: RightDataPanel | null,
  panel: RightDataPanel,
): boolean {
  return current === panel;
}
