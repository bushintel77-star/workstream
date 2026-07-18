import type { Project } from "./api";

/**
 * Legacy tab IA — retired. Operator work is one canvas with ?mode=.
 * Kept as empty helper so old imports compile; do not render these as nav.
 */
export type ProjectTab =
  | "overview"
  | "processing"
  | "survey"
  | "design"
  | "costing"
  | "audit"
  | "outputs"
  | "filing"
  | "tasks"
  | "recordings"
  | "measurements"
  | "carbon";

/** @deprecated One-canvas modes replace pipeline tabs. */
export function getProjectTabs(_project: Project): Array<{
  slug: ProjectTab;
  label: string;
}> {
  return [];
}

/** @deprecated */
export const PROJECT_SECTION_LABELS: Record<ProjectTab, string> = {
  overview: "Canvas",
  design: "Sketch",
  processing: "Canvas",
  survey: "Survey",
  costing: "Quote",
  audit: "Share",
  outputs: "Share",
  filing: "Share",
  tasks: "Canvas",
  recordings: "Canvas",
  measurements: "Canvas",
  carbon: "Canvas",
};
