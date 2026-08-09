import type { BomLine } from "@workstream/contracts";

/** Sum labour hours from Instant Planner BOM lines. */
export function summarizeLabourHours(lines: BomLine[]): number {
  let hours = 0;
  for (const line of lines) {
    if (line.tier !== "labour") continue;
    const unit = line.unit.toLowerCase();
    if (unit === "hr" || unit === "hour" || unit === "hrs" || unit === "h") {
      hours += line.qty;
    } else if (unit === "ea") {
      hours += line.qty * 0.5;
    }
  }
  return Math.round(hours * 10) / 10;
}

export function formatLabourChip(hours: number): string {
  if (hours <= 0) return "—";
  if (hours < 1) return `~${Math.max(0.5, hours).toFixed(1)} h`;
  return `~${Math.round(hours)} h`;
}
