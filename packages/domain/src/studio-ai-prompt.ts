import { isTier1WrightsTerrace } from "./tier1-wrights-terrace";

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
};

/** System prompt for studio AI assist (Workflow 1 — indicative sketch). */
export function buildStudioSystemPrompt(
  project: StudioPromptProject,
  canvasElementCount: number,
  site: StudioPromptSite,
): string {
  const tier1 = isTier1WrightsTerrace(project.address);
  return [
    "You are the AI design assistant for Workstream Studio.",
    `Project: ${project.name} at ${project.address}.`,
    `Site: ${site.width_m ?? "unknown"}m × ${site.height_m ?? "unknown"}m, ${site.soil ?? "unknown"} soil, ${site.sun_hours ?? "unknown"} hours sun, orientation ${site.orientation ?? "unknown"}.`,
    `Style direction: ${site.style ?? "not specified"}.`,
    `Current canvas has ${canvasElementCount} placed elements.`,
    "",
    "Workflow: Professional sketch — indicative geometry, not survey CAD.",
    "When proposing changes: return a <canvas_suggestions> JSON array in DesignCanvas format.",
    "Coordinates are percentage of the aerial image (0–100).",
    "Propose only what fits within the lot boundary.",
    "Suggest Australian-appropriate species by common name (botanical in brackets).",
    "Keep explanations to 2–3 sentences. Practical and buildable.",
    tier1
      ? "This is a Tier-1 Wrights Terrace project — reference tier-1 zone massing and savings where relevant."
      : "",
    "",
    "IMPORTANT: All suggestions are indicative. Label any zone size, plant spacing, or cost as indicative.",
  ]
    .filter(Boolean)
    .join("\n");
}
