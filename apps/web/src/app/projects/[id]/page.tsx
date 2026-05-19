import Link from "next/link";
import {
  getAudit,
  getDesign,
  getProject,
  getSurvey,
  getWeather,
  listCostings,
  listOutputs,
  listRecordings,
  listTasks,
} from "../../../lib/api";
import s from "../../../styles/app.module.css";
import p from "./project.module.css";
import {
  runAuditAction,
  runCostingAction,
  runDesignAction,
  runOutputAction,
  runSurveyAction,
} from "../../actions";
import { NotFoundPage, ProjectMasthead } from "./ProjectShell";
import { PipelineRail } from "../../../components/PipelineRail";
import { SubmitButton } from "../../../components/SubmitButton";
import { SiteWalkChecklist } from "../../../components/SiteWalkChecklist";

export const dynamic = "force-dynamic";

export default async function ProjectHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return (
      <NotFoundPage message="That project couldn't be loaded — it may have been deleted or the API just restarted." />
    );
  }

  const [survey, design, costings, audit, outputs, weather, tasks, recordings] =
    await Promise.all([
      getSurvey(id),
      getDesign(id),
      listCostings(id),
      getAudit(id),
      listOutputs(id),
      getWeather(id),
      listTasks(id),
      listRecordings(id),
    ]);

  const standardCosting =
    costings.find((c) => c.scenario === "standard") ?? costings[0] ?? null;
  const audGenBy = (kind: string) => outputs.find((o) => o.kind === kind);

  const aud0 = (n: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(n);

  /* Determine the single next-step CTA for the sticky bottom bar */
  let nextAction:
    | null
    | {
        label: string;
        pending: string;
        action: (fd: FormData) => Promise<void>;
        kind?: string;
        accent?: boolean;
      } = null;
  if (!survey) {
    nextAction = {
      label: "Run survey",
      pending: "Running survey…",
      action: runSurveyAction,
    };
  } else if (!design) {
    nextAction = {
      label: "Generate design",
      pending: "Designing…",
      action: runDesignAction,
    };
  } else if (costings.length === 0) {
    nextAction = {
      label: "Price it",
      pending: "Pricing…",
      action: runCostingAction,
    };
  } else if (!audit) {
    nextAction = {
      label: "Run audit",
      pending: "Auditing…",
      action: runAuditAction,
    };
  } else if (audit.passed && !audGenBy("quote")) {
    nextAction = {
      label: "Generate quote",
      pending: "Generating…",
      action: runOutputAction,
      kind: "quote",
      accent: true,
    };
  }

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="overview" />

      <h1 className={s.headline}>Pipeline</h1>
      <p className={s.lede}>
        Each stage runs in sequence — survey gives the lot, design proposes the
        zones, costing prices it three ways, audit checks the work, outputs
        produce the artefacts.
      </p>

      <PipelineRail
        stages={[
          {
            n: 1,
            label: "Survey",
            status: survey ? "done" : "todo",
            href: `/projects/${id}/survey`,
            meta: survey
              ? `Lot ${Math.round(survey.lot_area_m2)} m²`
              : "Not run yet",
          },
          {
            n: 2,
            label: "Design",
            status: design ? "done" : survey ? "todo" : "locked",
            href: `/projects/${id}/design`,
            meta: design
              ? `${design.proposal.zones.length} zones · v${design.version}`
              : survey
                ? "Ready"
                : "Needs survey",
          },
          {
            n: 3,
            label: "Costing",
            status: costings.length > 0 ? "done" : design ? "todo" : "locked",
            href: `/projects/${id}/costing`,
            meta: standardCosting
              ? aud0(standardCosting.total)
              : design
                ? "Ready"
                : "Needs design",
          },
          {
            n: 4,
            label: "Audit",
            status: audit
              ? audit.blocking_count > 0
                ? "blocked"
                : "done"
              : costings.length > 0
                ? "todo"
                : "locked",
            href: `/projects/${id}/audit`,
            meta: audit
              ? `${audit.blocking_count} blocking · ${audit.advisory_count} advisory`
              : costings.length > 0
                ? "Ready"
                : "Needs costing",
          },
          {
            n: 5,
            label: "Outputs",
            status:
              outputs.length > 0
                ? "done"
                : audit && audit.passed
                  ? "todo"
                  : "locked",
            href: `/projects/${id}/outputs`,
            meta:
              outputs.length > 0
                ? `${outputs.length} generated`
                : audit?.passed
                  ? "Ready"
                  : "Needs clean audit",
          },
        ]}
      />

      {nextAction && (
        <div className={`${s.actionBar} ${p.actionBarDesktopOnly}`}>
          <form action={nextAction.action}>
            <input type="hidden" name="projectId" value={id} />
            {nextAction.kind && (
              <input type="hidden" name="kind" value={nextAction.kind} />
            )}
            <SubmitButton
              className={`${s.btn} ${nextAction.accent ? s.btnAccent : ""}`}
              pendingLabel={nextAction.pending}
            >
              {nextAction.label}
            </SubmitButton>
          </form>
        </div>
      )}

      <h2 className={s.sectionHeading}>Snapshot</h2>
      <div className={s.grid3}>
        <div className={s.metric}>
          <span className={s.metricLabel}>Lot area</span>
          <span className={s.metricValue}>
            {survey ? Math.round(survey.lot_area_m2) : "—"}
            <span className={s.metricUnit}> m²</span>
          </span>
        </div>
        <div className={s.metric}>
          <span className={s.metricLabel}>Garden</span>
          <span className={s.metricValue}>
            {survey ? Math.round(survey.garden_area_m2) : "—"}
            <span className={s.metricUnit}> m²</span>
          </span>
        </div>
        <div className={s.metric}>
          <span className={s.metricLabel}>Standard total</span>
          <span className={s.metricValue}>
            {standardCosting ? aud0(standardCosting.total) : "—"}
          </span>
        </div>
        <div className={s.metric}>
          <span className={s.metricLabel}>Tasks open</span>
          <span className={s.metricValue}>
            {tasks.filter((t) => t.status !== "done" && t.status !== "cancelled")
              .length}
            <span className={s.metricUnit}> / {tasks.length}</span>
          </span>
        </div>
        <div className={s.metric}>
          <span className={s.metricLabel}>Recordings</span>
          <span className={s.metricValue}>{recordings.length}</span>
        </div>
        <div className={s.metric}>
          <span className={s.metricLabel}>Outputs</span>
          <span className={s.metricValue}>{outputs.length}</span>
        </div>
      </div>

      <SiteWalkChecklist />

      {weather && weather.days.length > 0 && (
        <>
          <h2 className={s.sectionHeading}>Forecast · next 5 days</h2>
          <div className={p.weatherRow}>
            {weather.days.slice(0, 5).map((d) => (
              <div key={d.date} className={p.weatherDay}>
                <span className={p.weatherDate}>
                  {new Date(d.date).toLocaleDateString("en-AU", {
                    weekday: "short",
                  })}
                </span>
                <span className={p.weatherTemp}>
                  {Math.round(d.temp_max_c)}°
                </span>
                <span className={p.weatherCond}>{d.condition}</span>
                {d.precipitation_mm > 0 && (
                  <span className={p.weatherRain}>
                    {d.precipitation_mm.toFixed(1)} mm
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {nextAction && (
        <>
          <div className={s.bottomBarSpacer} />
          <div className={s.bottomBar}>
            <form action={nextAction.action}>
              <input type="hidden" name="projectId" value={id} />
              {nextAction.kind && (
                <input type="hidden" name="kind" value={nextAction.kind} />
              )}
              <SubmitButton
                className={`${s.btn} ${nextAction.accent ? s.btnAccent : ""} ${p.bottomCta}`}
                pendingLabel={nextAction.pending}
              >
                {nextAction.label}
              </SubmitButton>
            </form>
          </div>
        </>
      )}
    </main>
  );
}

