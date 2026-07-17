import Link from "next/link";
import {
  getIntegrationSummary,
  listProjects,
  type ProjectStatus,
} from "../lib/api";
import s from "../styles/app.module.css";
import d from "./dashboard.module.css";
import { DashboardProjectRow } from "../components/DashboardProjectRow";
import { NewProjectAddressForm } from "../components/NewProjectAddressForm";
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

      <section className={d.gardenHero} aria-labelledby="sites-heading">
        <div className={d.metaRow}>
          <p className={d.kicker}>Curtis &amp; Co · landscape studio</p>
          <span className={d.count}>
            {projects.length} {projects.length === 1 ? "garden" : "gardens"}
          </span>
        </div>
        <h1 id="sites-heading" className={d.headline}>
          Sites in growth
        </h1>
        <p className={d.lede}>
          Walk the lot, lock the massing, price the plantings — then send a
          quote that feels like the finished garden.
        </p>
        <div className={d.composerWrap}>
          <NewProjectAddressForm />
        </div>
      </section>

      {loadError && (
        <div className={s.error} role="alert">
          Couldn&apos;t load projects: {loadError}
        </div>
      )}

      <div className={d.sectionHead}>
        <h2>Active gardens</h2>
      </div>

      {projects.length === 0 && !loadError ? (
        <div className={d.emptyGarden}>
          <h3 className={d.emptyTitle}>Ground not broken yet</h3>
          <p className={d.emptyBody}>
            Start with a Melbourne address above. Aerial, survey, design and
            quote grow from that first pin.
          </p>
        </div>
      ) : (
        <ul className={s.list}>
          {projects.map((p) => (
            <DashboardProjectRow
              key={p.id}
              projectId={p.id}
              address={p.address}
              statusPill={STATUS_PILL[p.status]}
              statusLabel={STATUS_LABEL[p.status]}
              createdLabel={fmtDate(p.created_at)}
            />
          ))}
        </ul>
      )}

      <footer className={s.colophon}>
        <span>Curtis &amp; Co · Melbourne</span>
        <span className={d.footerLinks}>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/settings">Settings</Link>
        </span>
      </footer>
    </main>
  );
}
