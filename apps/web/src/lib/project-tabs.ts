import type { Project } from "./api";

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

const BASE_TABS: Array<{ slug: ProjectTab; label: string }> = [
  { slug: "design", label: "Studio" },
  { slug: "overview", label: "Pipeline" },
  { slug: "survey", label: "Survey" },
  { slug: "costing", label: "Costing" },
  { slug: "audit", label: "Audit" },
  { slug: "outputs", label: "Outputs" },
  { slug: "filing", label: "Filing" },
  { slug: "tasks", label: "Tasks" },
  { slug: "recordings", label: "Recordings" },
  { slug: "measurements", label: "Measurements" },
  { slug: "carbon", label: "Carbon" },
];

export function getProjectTabs(project: Project) {
  if (project.status !== "processing") return BASE_TABS;
  const tabs = [...BASE_TABS];
  tabs.splice(2, 0, { slug: "processing", label: "Processing" });
  return tabs;
}

export const PROJECT_SECTION_LABELS: Record<ProjectTab, string> = {
  overview: "Pipeline",
  design: "Design studio",
  processing: "Processing",
  survey: "Survey",
  costing: "Costing",
  audit: "Audit",
  outputs: "Outputs",
  filing: "Filing",
  tasks: "Tasks",
  recordings: "Recordings",
  measurements: "Measurements",
  carbon: "Carbon",
};
