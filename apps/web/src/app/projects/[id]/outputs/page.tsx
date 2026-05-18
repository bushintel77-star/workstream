import {
  getProject,
  listOutputs,
  type OutputKind,
} from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import p from "../project.module.css";
import { runOutputAction } from "../../../actions";
import { NotFoundPage, ProjectMasthead } from "../ProjectShell";
import { SubmitButton } from "../../../../components/SubmitButton";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<OutputKind, string> = {
  quote: "Quote",
  scope: "Scope of works",
  schedule: "Schedule",
  task_list: "Task list",
  brochure: "Brochure",
  daily_site_report: "Daily site report",
  permit_stonnington_stormwater: "Permit · Stonnington stormwater",
  permit_yarra_heritage: "Permit · Yarra heritage",
};

const KIND_DESCRIPTIONS: Record<OutputKind, string> = {
  quote: "Branded HTML quote ready to send the client. Lean / Standard / Buffer scenarios surfaced.",
  scope: "Detailed scope of works for the build crew — every zone, every task.",
  schedule: "Build schedule with stages, durations and dependencies.",
  task_list: "Flat list of build tasks for crew dispatch.",
  brochure: "Client-facing brochure with the design narrative.",
  daily_site_report: "Daily progress capture for the operator to fill on site.",
  permit_stonnington_stormwater: "Pre-filled Stonnington stormwater permit pack.",
  permit_yarra_heritage: "Pre-filled Yarra heritage overlay submission.",
};

const ALL_KINDS: OutputKind[] = [
  "quote",
  "scope",
  "schedule",
  "task_list",
  "brochure",
  "daily_site_report",
  "permit_stonnington_stormwater",
  "permit_yarra_heritage",
];

export default async function OutputsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const outputs = await listOutputs(id);
  const byKind = new Map(outputs.map((o) => [o.kind, o]));

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="outputs" />

      <h1 className={s.headline}>Outputs</h1>
      <p className={s.lede}>
        Branded artefacts generated from the audited design and costing. Each
        kind regenerates on demand — the latest version overwrites the
        previous.
      </p>

      <h2 className={s.sectionHeading}>Available outputs</h2>
      <ul className={s.list}>
        {ALL_KINDS.map((k) => {
          const existing = byKind.get(k);
          return (
            <li key={k} className={p.outputCard}>
              <div className={p.outputMain}>
                <span className={p.outputKind}>{KIND_LABELS[k]}</span>
                <span className={p.outputMeta}>
                  {existing
                    ? `Generated ${fmt(existing.generated_at)}`
                    : KIND_DESCRIPTIONS[k]}
                </span>
              </div>
              <div className={p.outputActions}>
                {existing && (
                  <a
                    href={existing.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={s.btnGhost}
                  >
                    Open
                  </a>
                )}
                <form action={runOutputAction}>
                  <input type="hidden" name="projectId" value={id} />
                  <input type="hidden" name="kind" value={k} />
                  <SubmitButton
                    className={existing ? s.btnGhost : s.btn}
                    pendingLabel="Working…"
                  >
                    {existing ? "Regenerate" : "Generate"}
                  </SubmitButton>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
