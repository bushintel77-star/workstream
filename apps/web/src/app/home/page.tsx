import {
  listCostings,
  listProjects,
  type Project,
  type ProjectStatus,
} from "../../lib/api";
import { requireSignedIn } from "../../lib/auth";
import {
  DashboardProjects,
  type DashboardProject,
} from "../../components/DashboardProjects";
import { getIntegrationSummary } from "../../lib/api";
import { AppNav } from "../../components/AppNav";
import { NewProjectAddressForm } from "../../components/NewProjectAddressForm";
import home from "../home.module.css";

export const dynamic = "force-dynamic";

/** Canvas-stage labels — not the old pipeline hub names. */
const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Survey",
  recording: "Survey",
  processing: "Survey",
  survey_review: "Sketch",
  design_review: "CAD",
  cost_review: "Quote",
  audit: "Quote",
  outputs: "Share",
  complete: "Share",
};

function dashboardStatus(status: ProjectStatus): DashboardProject["status"] {
  if (status === "draft" || status === "recording") return "draft";
  if (status === "processing" || status === "survey_review") return "active";
  if (status === "design_review" || status === "cost_review" || status === "audit") {
    return "review";
  }
  return "complete";
}

function projectName(project: Project): string {
  if (project.client_name?.trim()) return project.client_name.trim();
  const [firstLine] = project.address.split(",");
  return firstLine?.trim() || "Untitled project";
}

async function toDashboardProject(project: Project): Promise<DashboardProject> {
  const costings = await listCostings(project.id).catch(() => []);
  const standard =
    costings.find((costing) => costing.scenario === "standard") ?? costings[0] ?? null;
  return {
    id: project.id,
    address: project.address,
    createdAt: project.created_at,
    status: dashboardStatus(project.status),
    stageLabel: STATUS_LABEL[project.status] ?? project.status,
    projectName: projectName(project),
    costTotal: standard?.total ?? null,
  };
}

/** Operator project register — editorial index. */
export default async function HomePage() {
  await requireSignedIn();
  let projects: DashboardProject[] = [];
  const summary = await getIntegrationSummary().catch(() => null);
  let loadError: string | null = null;
  try {
    const rawProjects = await listProjects();
    projects = await Promise.all(rawProjects.map(toDashboardProject));
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not reach the API.";
  }

  return (
    <main className={home.page}>
      <AppNav summary={summary} />

      <div className={home.layout}>
        {/* Masthead — matches the landing page tone */}
        <header className={home.masthead}>
          <p className={home.mastheadMark}>CURTIS &amp; CO</p>
          <h1 className={home.mastheadTitle}>Workstream</h1>
          <p className={home.mastheadLede}>
            Type an address. Get a concept, working drawing, and live estimate.
          </p>
        </header>

        {/* Address composer — minimal, no card wrapper */}
        <section className={home.composer} id="new-project">
          <label className={home.composerLabel} htmlFor="project-address">
            Address
          </label>
          <NewProjectAddressForm />
        </section>

        {/* Project index */}
        <DashboardProjects projects={projects} loadError={loadError} />
      </div>
    </main>
  );
}
