import {
  getAudit,
  getProject,
  listCostings,
  listOutputs,
  type Output,
  type OutputKind,
} from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import o from "../../../../components/outputs.module.css";
import { SendQuotePanel } from "../../../../components/SendQuotePanel";
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
  quote:
    "Branded client quote with scenario picker. Generate here, then create a portal link below.",
  scope: "Detailed scope of works for the build crew — every zone, every task.",
  schedule: "Build schedule with stages, durations and dependencies.",
  task_list: "Flat list of build tasks for crew dispatch.",
  brochure: "Client-facing brochure with the design narrative.",
  daily_site_report: "Daily progress capture for the operator to fill on site.",
  permit_stonnington_stormwater: "Pre-filled Stonnington stormwater permit pack.",
  permit_yarra_heritage: "Pre-filled Yarra heritage overlay submission.",
};

const SECONDARY_KINDS: OutputKind[] = [
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

  const [outputs, costings, audit] = await Promise.all([
    listOutputs(id),
    listCostings(id),
    getAudit(id),
  ]);
  const byKind = new Map(outputs.map((o) => [o.kind, o]));
  const quote = byKind.get("quote");

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });

  const portalReady = costings.length > 0;
  const portalHint = !portalReady
    ? "Run costing before sending a client link — the portal needs priced scenarios."
    : audit && !audit.passed
      ? "Audit has blocking findings. You can still preview, but resolve blockers before the client signs."
      : "";

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="outputs" />

      <h1 className={s.headline}>Outputs</h1>
      <p className={s.lede}>
        Generate artefacts from the audited design, then send the quote through
        the client portal — one link, three scenarios, deposit when they are
        ready.
      </p>

      <section className={o.hero} aria-labelledby="quote-hero-title">
        <div className={o.heroTop}>
          <div>
            <span className={o.heroKicker}>Primary deliverable</span>
            <h2 id="quote-hero-title" className={o.heroTitle}>
              Client quote
            </h2>
            <p className={o.heroDesc}>{KIND_DESCRIPTIONS.quote}</p>
            {quote && (
              <p className={o.heroMeta}>Last generated {fmt(quote.generated_at)}</p>
            )}
          </div>
          <div className={o.heroActions}>
            {quote && (
              <a
                href={quote.uri}
                target="_blank"
                rel="noopener noreferrer"
                className={s.btnGhost}
              >
                Open HTML
              </a>
            )}
            <form action={runOutputAction}>
              <input type="hidden" name="projectId" value={id} />
              <input type="hidden" name="kind" value="quote" />
              <SubmitButton
                className={quote ? s.btnGhost : `${s.btn} ${s.btnAccent}`}
                pendingLabel="Generating…"
              >
                {quote ? "Regenerate quote" : "Generate quote"}
              </SubmitButton>
            </form>
          </div>
        </div>

        {portalHint && portalReady && (
          <p className={o.sendPanelWarn}>{portalHint}</p>
        )}

        <SendQuotePanel
          projectId={id}
          ready={portalReady}
          readyHint="Run costing before sending a client link — the portal needs priced scenarios."
        />
      </section>

      <h2 className={s.sectionHeading}>Build &amp; permits</h2>
      <ul className={o.grid}>
        {SECONDARY_KINDS.map((k) => (
          <OutputCard
            key={k}
            kind={k}
            projectId={id}
            existing={byKind.get(k)}
            fmt={fmt}
          />
        ))}
      </ul>
    </main>
  );
}

function OutputCard({
  kind,
  projectId,
  existing,
  fmt,
}: {
  kind: OutputKind;
  projectId: string;
  existing?: Output;
  fmt: (iso: string) => string;
}) {
  return (
    <li className={o.card}>
      <div className={o.cardHead}>
        <h3 className={o.cardTitle}>{KIND_LABELS[kind]}</h3>
        <p className={o.cardDesc}>
          {existing ? "Ready to open or regenerate." : KIND_DESCRIPTIONS[kind]}
        </p>
      </div>
      {existing && (
        <p className={o.cardMeta}>Generated {fmt(existing.generated_at)}</p>
      )}
      <div className={o.cardActions}>
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
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="kind" value={kind} />
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
}
