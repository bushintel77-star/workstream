import type { StudioTool } from "../../studioCatalog";

/**
 * Draft tools that stay sticky until cancelled.
 * CAD practice (KiCad / Fusion): Esc returns to the default pan tool.
 */
const STICKY_TOOLS: ReadonlySet<StudioTool> = new Set([
  "measure",
  "add",
  "paint",
  "path",
  "trace",
  "zone",
  "edit",
  "service",
  "calib",
  "level",
  "lock",
]);

export function isStickyDraftTool(tool: StudioTool): boolean {
  return STICKY_TOOLS.has(tool);
}
