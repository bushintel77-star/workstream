import { isTier1WrightsTerrace } from "./tier1-wrights-terrace";
import { buildIndicativeShadeGrid } from "./shade-grid";
import {
  evaluateStudioCompliance,
  type StudioComplianceItem,
} from "./studio-preemptive-compliance";

export type StudioPromptProject = {
  name: string;
  address: string;
};

export type StudioPromptSite = {
  width_m?: number;
  height_m?: number;
  soil?: string;
  sun_hours?: number;
  orientation?: string;
  style?: string;
  lat?: number;
  lng?: number;
  /** Workable outdoor m² after Turf lot − building − easements. */
  workable_m2?: number;
  /** Closed easement rings on the durable site_frame. */
  easement_count?: number;
  /** Open service corridor polylines. */
  service_count?: number;
  /** Board scale (metres across 100% width) when known. */
  scale_m?: number;
  /** One-line compliance pass/fail (permeability / canopy / outdoor). */
  compliance_summary?: string;
  /** One-line indicative shade mesh readout. */
  shade_summary?: string;
};

/** Coarse symbol_id → compliance item type for assist grounding. */
export function coarseSymbolToComplianceType(
  symbolId: string,
): StudioComplianceItem["t"] {
  const key = symbolId.toLowerCase();
  if (/drain|french|storm/.test(key)) return "frenchdrain";
  if (/pav|bluestone|path|step/.test(key)) return "paving";
  if (/deck/.test(key)) return "deck";
  if (/lawn|turf/.test(key)) return "lawn";
  if (/hedge|pleach|screen|buxus/.test(key)) return "hedge";
  if (/bed|lomandra|plant|mass/.test(key)) return "bed";
  if (/feature|specimen|cycas/.test(key)) return "feature";
  if (/exist|trp|retain|root/.test(key)) return "exist";
  return "canopy";
}

/**
 * Build compliance + shade one-liners for studio AI assist grounding.
 * Indicative Workflow 1 — not EnergyPlus / lodgement.
 */
export function buildAssistSiteIntel(args: {
  outdoorM2: number;
  placements: Array<{
    id: string;
    symbol_id: string;
    x_pct: number;
    y_pct: number;
    scale?: number;
    label?: string | null;
  }>;
  boundary?: Array<{ x_pct: number; y_pct: number }>;
  lat?: number;
  lng?: number;
  scaleM?: number;
}): Pick<StudioPromptSite, "compliance_summary" | "shade_summary" | "sun_hours"> {
  const items: StudioComplianceItem[] = args.placements.map((p) => {
    let dbhM: number | undefined;
    if (p.label) {
      const m = /^exist:dbh=([\d.]+)$/.exec(p.label);
      if (m) {
        const n = Number.parseFloat(m[1]!);
        if (Number.isFinite(n) && n > 0) dbhM = n;
      }
    }
    return {
      id: p.id,
      t: coarseSymbolToComplianceType(p.symbol_id),
      x: p.x_pct,
      y: p.y_pct,
      scale: p.scale ?? 1,
      ghost: false,
      dbhM,
    };
  });

  const compliance = evaluateStudioCompliance({
    outdoorM2: args.outdoorM2,
    boundary: (args.boundary ?? []).map((p) => ({ x: p.x_pct, y: p.y_pct })),
    items,
    scaleM: args.scaleM ?? 110,
  });

  const passBits = [
    compliance.outdoorOk ? "outdoor ok" : "outdoor watch",
    compliance.permeableOk ? "permeable ok" : "permeable fail",
    compliance.canopyOk ? "canopy ok" : "canopy short",
  ];
  const alertBits = compliance.alerts
    .slice(0, 2)
    .map((a) => a.title)
    .join("; ");
  const compliance_summary = alertBits
    ? `Compliance: ${passBits.join(" · ")} — ${alertBits}`
    : `Compliance: ${passBits.join(" · ")}`;

  const lat = args.lat ?? -37.849;
  const lng = args.lng ?? 144.993;
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  const cells = buildIndicativeShadeGrid(lat, lng, noon);
  const avg =
    cells.reduce((s, c) => s + c.sunHours, 0) / Math.max(1, cells.length);
  const deep = cells.filter((c) => c.sunHours < 3.5).length;
  const shade_summary = `Shade mesh (indicative midday): avg ${avg.toFixed(1)} h sun · ${deep}/${cells.length} cells deep shade — prefer shade-tolerant species in deep cells.`;

  return {
    compliance_summary,
    shade_summary,
    sun_hours: +avg.toFixed(1),
  };
}

/** System prompt for studio AI assist (Workflow 1 — indicative sketch). */
export function buildStudioSystemPrompt(
  project: StudioPromptProject,
  canvasElementCount: number,
  site: StudioPromptSite,
): string {
  const tier1 = isTier1WrightsTerrace(project.address);
  const siteFacts = [
    `Site: ${site.width_m ?? "unknown"}m × ${site.height_m ?? "unknown"}m, ${site.soil ?? "unknown"} soil, ${site.sun_hours ?? "unknown"} hours sun, orientation ${site.orientation ?? "unknown"}.`,
  ];
  if (site.workable_m2 != null && Number.isFinite(site.workable_m2)) {
    siteFacts.push(
      `Workable outdoor canvas (lot − building − easements): ~${site.workable_m2.toFixed(0)} m² — do not propose hardscape inside easement hatch.`,
    );
  }
  if (site.easement_count != null && site.easement_count > 0) {
    siteFacts.push(
      `${site.easement_count} easement hatch ring(s) on title frame — treat as non-buildable until council confirms.`,
    );
  }
  if (site.service_count != null && site.service_count > 0) {
    siteFacts.push(
      `${site.service_count} service corridor trace(s) — keep clear of excavation where practical.`,
    );
  }
  if (site.scale_m != null && Number.isFinite(site.scale_m)) {
    siteFacts.push(`Board scale ≈ ${site.scale_m.toFixed(1)} m across 100% width.`);
  }
  if (site.compliance_summary) {
    siteFacts.push(site.compliance_summary);
  }
  if (site.shade_summary) {
    siteFacts.push(site.shade_summary);
  }

  return [
    "You are the AI design assistant for Workstream Studio.",
    `Project: ${project.name} at ${project.address}.`,
    ...siteFacts,
    `Style direction: ${site.style ?? "not specified"}.`,
    `Current canvas has ${canvasElementCount} placed elements.`,
    "",
    "Workflow: Professional sketch — indicative geometry, not survey CAD.",
    "When proposing changes: return a <canvas_suggestions> JSON array in DesignCanvas format.",
    "Coordinates are percentage of the aerial image (0–100).",
    "Propose only what fits within the lot boundary and outside easement hatch.",
    "Respect compliance + shade summaries — prefer permeable and shade-tolerant planting where flagged.",
    "Suggest Australian-appropriate species by common name (botanical in brackets).",
    "Keep explanations to 2–3 sentences. Practical and buildable.",
    "Curtis & Co palette preference: pleached hornbeam, mass-planted Lomandra, bluestone — reject off-palette species.",
    tier1
      ? "This is a Tier-1 Wrights Terrace project — reference tier-1 zone massing and savings where relevant."
      : "",
    "",
    "IMPORTANT: All suggestions are indicative. Label any zone size, plant spacing, or cost as indicative.",
  ]
    .filter(Boolean)
    .join("\n");
}
