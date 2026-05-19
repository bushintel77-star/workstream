import Link from "next/link";
import { listProjects, type ProjectStatus } from "../lib/api";
import s from "../styles/app.module.css";
import d from "./dashboard.module.css";
import { createProjectAction, deleteProjectAction } from "./actions";
import { SubmitButton } from "../components/SubmitButton";
import { requireSignedIn } from "../lib/auth";

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
  let loadError: string | null = null;
  try {
    projects = await listProjects();
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

      <form action={createProjectAction} className={d.form}>
        <input
          className={`${s.input} ${d.formInput}`}
          name="address"
          type="text"
          placeholder="Site address — e.g. 22 Smith St, Carlton VIC 3053"
          required
          minLength={5}
          autoComplete="off"
        />
        <SubmitButton className={s.btn} pendingLabel="Creating…">
          New project
        </SubmitButton>
      </form>

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
              <form action={deleteProjectAction}>
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  className={`${s.btnDanger} ${d.rowDelete}`}
                  aria-label={`Delete ${p.address}`}
                  title="Delete"
                >
                  Delete
                </button>
              </form>
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
