import Link from "next/link";
import {
  getIntegrationSummary,
  listProjects,
  type ProjectStatus,
} from "../lib/api";
import s from "../styles/app.module.css";
import d from "./dashboard.module.css";
import { DeleteProjectButton } from "../components/DeleteProjectButton";
import { NewProjectAddressForm } from "../components/NewProjectAddressForm";
import { SubmitButton } from "../components/SubmitButton";
import { requireSignedIn } from "../lib/auth";
import { AppNav } from "../components/AppNav";
import { IntegrationSetupChecklist } from "../components/IntegrationSetupChecklist";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Draft",
  recording: "Recording",
  processing: "Processing",
  survey_review: "Survey",
  design_review: "Design",
  cost_review: "Costing",
  audit: "Audit",
  outputs: "Outputs",
  complete: "Complete",
};

const STATUS_PILL: Record<ProjectStatus, string> = {
  draft: s.pillMuted,
  recording: s.pillInfo,
  processing: s.pillInfo,
  survey_review: s.pillInfo,
  design_review: s.pillAccent,
  cost_review: s.pillAccent,
  audit: s.pillWarn,
  outputs: s.pillOk,
  complete: s.pillOk,
};

export default async function DashboardPage() {
  await requireSignedIn();
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  let summary: Awaited<ReturnType<typeof getIntegrationSummary>> | null = null;
  let loadError: string | null = null;
  try {
    [projects, summary] = await Promise.all([
      listProjects(),
      getIntegrationSummary(),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not reach the API.";
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <main className={s.pageNarrow}>
      <AppNav summary={summary} />
      {summary && <IntegrationSetupChecklist summary={summary} />}
      <header className={s.masthead}>
        <div className={s.brand}>
          Curtis &amp; Co
          <span className={s.brandSub}>Workstream · Projects</span>
        </div>
        <span className={s.crumb}>
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </span>
      </header>

      <h1 className={s.headline}>Projects</h1>
      <p className={s.lede}>
        Every site Tim walks. Add a new address to start a project — survey,
        design, costing, audit and outputs flow from there.
      </p>

      <NewProjectAddressForm />

      {loadError && (
        <div className={s.error}>Couldn&apos;t load projects: {loadError}</div>
      )}

      <h2 className={s.sectionHeading}>Active</h2>

      {projects.length === 0 && !loadError ? (
        <div className={s.empty}>
          No projects yet. Add a site address above to start one.
        </div>
      ) : (
        <ul className={s.list}>
          {projects.map((p) => (
            <li key={p.id} className={`${s.card} ${d.row}`}>
              <Link href={`/projects/${p.id}`} className={d.rowLink}>
                <span className={d.rowAddress}>{p.address}</span>
                <span className={`${s.brandSub} ${d.rowMeta}`}>
                  <span className={`${s.pill} ${STATUS_PILL[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                  <span>{fmtDate(p.created_at)}</span>
                </span>
              </Link>
              <DeleteProjectButton projectId={p.id} address={p.address} />
            </li>
          ))}
        </ul>
      )}

      <footer className={s.colophon}>
        <span>Curtis &amp; Co · Melbourne</span>
        <span className={d.footerLinks}>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/settings">Settings →</Link>
        </span>
      </footer>
    </main>
  );
}
