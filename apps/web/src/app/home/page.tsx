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
import { HomePlanner } from "../../components/HomePlanner";
import { PlannerDock } from "../../components/PlannerDock";
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

/** Operator dashboard — Swiss grid planner + project register. */
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
        {/* Left column — product masthead + address composer */}
        <aside className={home.aside}>
          <header className={home.masthead}>
            <p className={home.mastheadMark}>Workstream · Melbourne</p>
            <h1 className={home.mastheadTitle}>Workstream</h1>
          </header>

          {/* Workspace state — data chips, separated from the composer action. */}
          {summary ? (
            <div
              className={home.stateStrip}
              role="status"
              aria-label="Workspace state"
              data-testid="workspace-state"
            >
              <span
                className={home.stateChip}
                data-tone={summary.plan === "studio" ? "studio" : "lite"}
              >
                {summary.plan === "studio" ? "Studio" : "Lite"} plan
              </span>
              <span className={home.stateChip}>
                Seats {summary.seats_used ?? 0}/{summary.seat_limit}
              </span>
              <span className={home.stateChip}>
                Live {summary.live_channels}/{summary.total_channels}
              </span>
              <span
                className={home.stateChip}
                data-tone={summary.needs_attention ? "warn" : "ok"}
              >
                {summary.needs_attention ? "Attention needed" : "All clear"}
              </span>
            </div>
          ) : null}

          <section className={home.composer} id="new-project">
            <label className={home.composerLabel} htmlFor="project-address">
              New address
            </label>
            <NewProjectAddressForm />
          </section>
        </aside>

        {/* Main area — project register */}
        <section className={home.index}>
          <DashboardProjects projects={projects} loadError={loadError} />
        </section>
      </div>

      {/* Planner dock — RailDrawer on desktop, BottomDock on mobile */}
      <PlannerDock label="Planner" accent="blue">
        <HomePlanner projects={projects} />
      </PlannerDock>
    </main>
  );
}
