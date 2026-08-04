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
        {/* Left column — masthead + address composer */}
        <aside className={home.aside}>
          <header className={home.masthead}>
            <div className={home.titleBlock}>
              <p className={home.mastheadMark}>Workstream · Melbourne</p>
              <div className={home.titleBlockMeta}>
                <span>DWG-001</span>
                <span>1:200</span>
                <span>{new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date())}</span>
              </div>
            </div>
            <h1 className={home.mastheadTitle}>STUDIOK</h1>
            <div className={home.dimLine} aria-hidden />
          </header>

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

      {/* Drawing footer — north arrow + scale bar */}
      <footer className={home.drawingFooter} aria-hidden>
        <div className={home.northArrow}>
          <span className={home.northN}>N</span>
          <span className={home.northGlyph}>↑</span>
        </div>
        <div className={home.scaleBar}>
          <span className={home.scaleSeg} />
          <span className={`${home.scaleSeg} ${home.scaleSegAlt}`} />
          <span className={home.scaleSeg} />
          <span className={`${home.scaleSeg} ${home.scaleSegAlt}`} />
          <span className={home.scaleLabel}>0 — 10m</span>
        </div>
      </footer>
    </main>
  );
}
