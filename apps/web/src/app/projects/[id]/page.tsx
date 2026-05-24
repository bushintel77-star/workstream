import Link from "next/link";
import { requireProject } from "../../../lib/project-guard";
import {
  getAudit,
  getDesign,
  getSurvey,
  getDesignCanvas,
  getEnvelopeBrief,
  getSiteContext,
  getWeather,
  listCostings,
  listOutputs,
  listProjectActivity,
  listRecordings,
  listTasks,
} from "../../../lib/api";
import { loadOptional } from "../../../lib/load-optional";
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
import { PipelineActionForm } from "../../../components/PipelineActionForm";
import { ProjectTitleHero } from "../../../components/ProjectTitleSiteMap";
import { SiteProjectWidgets } from "../../../components/SiteProjectWidgets";
import { ProjectClientHandoff } from "../../../components/ProjectClientHandoff";
import { getIntegrationHub } from "../../../lib/api";
import { ActivityTimeline } from "../../../components/ActivityTimeline";

export const dynamic = "force-dynamic";

export default async function ProjectHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject(id);
  if (!project) {
    return (
      <NotFoundPage message="That project couldn't be loaded — it may have been deleted or the API just restarted." />
    );
  }

  const loaded = await Promise.all([
    loadOptional("Survey", () => getSurvey(id)),
    loadOptional("Design", () => getDesign(id)),
    loadOptional("Costing", () => listCostings(id)),
    loadOptional("Audit", () => getAudit(id)),
    loadOptional("Outputs", () => listOutputs(id)),
    loadOptional("Weather", () => getWeather(id)),
    loadOptional("Site context", () => getSiteContext(id)),
    loadOptional("Tasks", () => listTasks(id)),
    loadOptional("Recordings", () => listRecordings(id)),
    loadOptional("Design canvas", () => getDesignCanvas(id)),
    loadOptional("Activity", () => listProjectActivity(id)),
  ]);

  const pick = <T,>(label: string) =>
    loaded.find((r) => r.label === label)! as {
      label: string;
      data: T | null;
      failed: boolean;
    };

  const survey = pick<Awaited<ReturnType<typeof getSurvey>>>("Survey").data;
  const design = pick<Awaited<ReturnType<typeof getDesign>>>("Design").data;
  const costings =
    pick<Awaited<ReturnType<typeof listCostings>>>("Costing").data ?? [];
  const audit = pick<Awaited<ReturnType<typeof getAudit>>>("Audit").data;
  const outputs =
    pick<Awaited<ReturnType<typeof listOutputs>>>("Outputs").data ?? [];
  const weather = pick<Awaited<ReturnType<typeof getWeather>>>("Weather").data;
  const siteContext =
    pick<Awaited<ReturnType<typeof getSiteContext>>>("Site context").data;
  const tasks = pick<Awaited<ReturnType<typeof listTasks>>>("Tasks").data ?? [];
  const recordings =
    pick<Awaited<ReturnType<typeof listRecordings>>>("Recordings").data ?? [];
  const canvas =
    pick<Awaited<ReturnType<typeof getDesignCanvas>>>("Design canvas").data;
  const activity =
    pick<Awaited<ReturnType<typeof listProjectActivity>>>("Activity").data ??
    [];
  const loadFailures = loaded.filter((r) => r.failed).map((r) => r.label);

  const envelope =
    survey != null
      ? await getEnvelopeBrief(id).catch(() => null)
      : null;

  const quoteOutput = outputs.find((o) => o.kind === "quote");
  const hasCanvas = (canvas?.placements?.length ?? 0) > 0;

  let lastCrmDetail: string | null = null;
  try {
    const hub = await getIntegrationHub();
    const ev = hub.events.find(
      (e) => e.project_id === id && e.channel === "crm",
    );
    lastCrmDetail = ev?.detail ?? null;
  } catch {
    /* hub optional */
  }

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

      <ProjectClientHandoff
        project={project}
        quoteUrl={quoteOutput?.uri ?? null}
        hasQuote={!!quoteOutput}
        lastCrmDetail={lastCrmDetail}
      />

      <h1 className={s.headline}>Pipeline</h1>
      <p className={s.lede}>
        Each stage runs in sequence — survey gives the lot, design proposes the
        zones, costing prices it three ways, audit checks the work, outputs
        produce the artefacts.
      </p>

      {loadFailures.length > 0 && (
        <div className={s.banner} role="status">
          Some sections could not load ({loadFailures.join(", ")}). Refresh the
          page or open the tab directly — other data below is still available.
        </div>
      )}

      <ProjectTitleHero
        survey={survey}
        address={project.address}
        siteContext={siteContext}
        kicker="Landscape project"
        designHref={survey ? `/projects/${id}/design` : undefined}
      />

      <SiteProjectWidgets
        project={project}
        siteContext={siteContext}
        tasks={tasks}
        envelope={envelope}
        standardTotal={standardCosting?.total ?? null}
        hasSurvey={survey != null}
        hasDesign={design != null}
        hasCosting={costings.length > 0}
        auditPassed={audit?.passed ?? false}
        hasQuote={quoteOutput != null}
        hasCanvas={(canvas?.placements?.length ?? 0) > 0}
        weatherRain={weather?.days?.[0]?.precipitation_mm != null && weather.days[0].precipitation_mm > 1}
        weatherWind={weather?.days?.some((d) => d.wind_speed_kmh > 40) ?? false}
      />

      <div className={p.pipeline}>
        <Stage
          n={1}
          label="Survey"
          status={survey ? "done" : "todo"}
          href={`/projects/${id}/survey`}
          meta={
            survey
              ? `Lot ${Math.round(survey.lot_area_m2)} m²`
              : "Not run yet"
          }
        />
        <Stage
          n={2}
          label={hasCanvas || design ? "Design" : "Sketch"}
          status={design ? "done" : survey ? "todo" : "locked"}
          href={`/projects/${id}/design`}
          meta={
            design
              ? `${design.proposal.zones.length} zones · v${design.version}`
              : hasCanvas
                ? "Layout on aerial"
                : survey
                  ? "Open studio"
                  : "Needs survey"
          }
        />
        <Stage
          n={3}
          label="Costing"
          status={
            costings.length > 0 ? "done" : design ? "todo" : "locked"
          }
          href={`/projects/${id}/costing`}
          meta={
            standardCosting
              ? aud0(standardCosting.total)
              : design
                ? "Ready"
                : "Needs design"
          }
        />
        <Stage
          n={4}
          label="Audit"
          status={
            audit
              ? audit.blocking_count > 0
                ? "blocked"
                : "done"
              : costings.length > 0
                ? "todo"
                : "locked"
          }
          href={`/projects/${id}/audit`}
          meta={
            audit
              ? `${audit.blocking_count} blocking · ${audit.advisory_count} advisory`
              : costings.length > 0
                ? "Ready"
                : "Needs costing"
          }
        />
        <Stage
          n={5}
          label="Outputs"
          status={
            outputs.length > 0
              ? "done"
              : audit && audit.passed
                ? "todo"
                : "locked"
          }
          href={`/projects/${id}/outputs`}
          meta={
            outputs.length > 0
              ? `${outputs.length} generated`
              : audit?.passed
                ? "Ready"
                : "Needs clean audit"
          }
        />
      </div>

      {nextAction && (
        <div className={`${s.actionBar} ${p.actionBarDesktopOnly}`}>
          <PipelineActionForm
            projectId={id}
            action={nextAction.action}
            label={nextAction.label}
            pendingLabel={nextAction.pending}
            successMessage={`${nextAction.label} complete`}
            className={nextAction.accent ? s.btnAccent : ""}
            accent={nextAction.accent}
            kind={nextAction.kind}
          />
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

      <section className={s.card}>
        <h2 className={s.sectionHeading}>Recent activity</h2>
        <p className={s.brandSub}>
          Deletes, restores, and filing changes on this project.
        </p>
        <ActivityTimeline events={activity} />
      </section>

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
            <PipelineActionForm
              projectId={id}
              action={nextAction.action}
              label={nextAction.label}
              pendingLabel={nextAction.pending}
              successMessage={`${nextAction.label} complete`}
              className={`${p.bottomCta} ${nextAction.accent ? s.btnAccent : ""}`}
              accent={nextAction.accent}
              kind={nextAction.kind}
            />
          </div>
        </>
      )}
    </main>
  );
}

function Stage({
  n,
  label,
  status,
  href,
  meta,
}: {
  n: number;
  label: string;
  status: "done" | "todo" | "locked" | "blocked";
  href: string;
  meta: string;
}) {
  const cls =
    status === "done"
      ? p.stageDone
      : status === "blocked"
        ? p.stageBlocked
        : "";
  if (status === "locked") {
    return (
      <div className={`${p.stage} ${p.stageLocked}`} aria-disabled="true">
        <span className={p.stageNum}>0{n}</span>
        <span className={p.stageLabel}>{label}</span>
        <span className={p.stageMeta}>{meta}</span>
      </div>
    );
  }
  return (
    <Link href={href} className={`${p.stage} ${cls}`}>
      <span className={p.stageNum}>0{n}</span>
      <span className={p.stageLabel}>{label}</span>
      <span className={p.stageMeta}>{meta}</span>
    </Link>
  );
}
