import type {
  ActivityEvent,
  Audit,
  Costing,
  Design,
  DesignCanvas,
  EnvelopeBrief,
  Output,
  Project,
  Recording,
  SiteContext,
  Survey,
  Task,
  WeatherForecast,
} from "../lib/api";
import type { ProjectNextAction } from "../lib/project-next-action";
import s from "../styles/app.module.css";
import p from "../app/projects/[id]/project.module.css";
import { PipelineImageShell } from "./PipelineImageShell";
import sh from "./pipelineImageShell.module.css";
import { PipelineAerialHero } from "./PipelineAerialHero";
import { PipelineStage } from "./PipelineStage";
import { SiteProjectWidgets } from "./SiteProjectWidgets";
import { ProjectClientHandoff } from "./ProjectClientHandoff";
import { PipelineActionForm } from "./PipelineActionForm";
import { ActivityTimeline } from "./ActivityTimeline";

type Props = {
  project: Project;
  projectId: string;
  survey: Survey;
  siteContext: SiteContext | null;
  design: Design | null;
  costings: Costing[];
  audit: Audit | null;
  outputs: Output[];
  tasks: Task[];
  recordings: Recording[];
  canvas: DesignCanvas | null;
  activity: ActivityEvent[];
  weather: WeatherForecast | null;
  envelope: EnvelopeBrief | null;
  loadFailures: string[];
  quoteOutput: Output | undefined;
  lastCrmDetail: string | null;
  nextAction: ProjectNextAction | null;
};

function aud0(n: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Pipeline hub — image-shell framework with workflow rail. */
export function PipelineHubView(props: Props) {
  const {
    project,
    projectId,
    survey,
    siteContext,
    design,
    costings,
    audit,
    outputs,
    tasks,
    recordings,
    canvas,
    activity,
    weather,
    envelope,
    loadFailures,
    quoteOutput,
    lastCrmDetail,
    nextAction,
  } = props;

  const hasCanvas = (canvas?.placements?.length ?? 0) > 0;
  const standardCosting =
    costings.find((c) => c.scenario === "standard") ?? costings[0] ?? null;
  const designHref = `/projects/${projectId}/design`;

  const nextActionForm = nextAction ? (
    <PipelineActionForm
      projectId={projectId}
      action={nextAction.action}
      label={nextAction.label}
      pendingLabel={nextAction.pending}
      successMessage={`${nextAction.label} complete`}
      className={nextAction.accent ? s.btnAccent : ""}
      accent={nextAction.accent}
      kind={nextAction.kind}
    />
  ) : null;

  const rail = (
    <div className={sh.railScroll}>
      <ProjectClientHandoff
        project={project}
        quoteUrl={quoteOutput?.uri ?? null}
        hasQuote={!!quoteOutput}
        lastCrmDetail={lastCrmDetail}
      />

      <p className={s.lede}>
        Each stage runs in sequence — survey gives the lot, design proposes the zones,
        costing prices it three ways, audit checks the work, outputs produce the
        artefacts.
      </p>

      {loadFailures.length > 0 ? (
        <div className={s.banner} role="status">
          Some sections could not load ({loadFailures.join(", ")}). Refresh the page or
          open the tab directly — other data below is still available.
        </div>
      ) : null}

      <SiteProjectWidgets
        project={project}
        siteContext={siteContext}
        tasks={tasks}
        envelope={envelope}
        standardTotal={standardCosting?.total ?? null}
        hasSurvey
        hasDesign={design != null}
        hasCosting={costings.length > 0}
        auditPassed={audit?.passed ?? false}
        hasQuote={quoteOutput != null}
        hasCanvas={hasCanvas}
        weatherRain={
          weather?.days?.[0]?.precipitation_mm != null &&
          weather.days[0].precipitation_mm > 1
        }
        weatherWind={weather?.days?.some((d) => d.wind_speed_kmh > 40) ?? false}
      />

      <div className={p.pipeline}>
        <PipelineStage
          n={1}
          label="Survey"
          status="done"
          href={`/projects/${projectId}/survey`}
          meta={`Lot ${Math.round(survey.lot_area_m2)} m²`}
        />
        <PipelineStage
          n={2}
          label={hasCanvas || design ? "Design" : "Sketch"}
          status={design ? "done" : "todo"}
          href={designHref}
          meta={
            design
              ? `${design.proposal.zones.length} zones · v${design.version}`
              : hasCanvas
                ? "Layout on aerial"
                : "Open studio"
          }
        />
        <PipelineStage
          n={3}
          label="Costing"
          status={costings.length > 0 ? "done" : design ? "todo" : "locked"}
          href={`/projects/${projectId}/costing`}
          meta={
            standardCosting
              ? aud0(standardCosting.total)
              : design
                ? "Ready"
                : "Needs design"
          }
        />
        <PipelineStage
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
          href={`/projects/${projectId}/audit`}
          meta={
            audit
              ? `${audit.blocking_count} blocking · ${audit.advisory_count} advisory`
              : costings.length > 0
                ? "Ready"
                : "Needs costing"
          }
        />
        <PipelineStage
          n={5}
          label="Outputs"
          status={
            outputs.length > 0 ? "done" : audit && audit.passed ? "todo" : "locked"
          }
          href={`/projects/${projectId}/outputs`}
          meta={
            outputs.length > 0
              ? `${outputs.length} generated`
              : audit?.passed
                ? "Ready"
                : "Needs clean audit"
          }
        />
      </div>

      {nextAction ? (
        <div className={`${s.actionBar} ${p.actionBarDesktopOnly}`}>{nextActionForm}</div>
      ) : null}

      <h2 className={s.sectionHeading}>Snapshot</h2>
      <div className={s.grid3}>
        <div className={s.metric}>
          <span className={s.metricLabel}>Lot area</span>
          <span className={s.metricValue}>
            {Math.round(survey.lot_area_m2)}
            <span className={s.metricUnit}> m²</span>
          </span>
        </div>
        <div className={s.metric}>
          <span className={s.metricLabel}>Garden</span>
          <span className={s.metricValue}>
            {Math.round(survey.garden_area_m2)}
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
            {tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length}
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

      {weather && weather.days.length > 0 ? (
        <>
          <h2 className={s.sectionHeading}>Forecast · next 5 days</h2>
          <div className={p.weatherRow}>
            {weather.days.slice(0, 5).map((d) => (
              <div key={d.date} className={p.weatherDay}>
                <span className={p.weatherDate}>
                  {new Date(d.date).toLocaleDateString("en-AU", { weekday: "short" })}
                </span>
                <span className={p.weatherTemp}>{Math.round(d.temp_max_c)}°</span>
                <span className={p.weatherCond}>{d.condition}</span>
                {d.precipitation_mm > 0 ? (
                  <span className={p.weatherRain}>{d.precipitation_mm.toFixed(1)} mm</span>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );

  return (
    <>
      <PipelineImageShell
        testId="pipeline-hub-image-shell"
        canvasCol={
          <PipelineAerialHero
            survey={survey}
            projectId={projectId}
            siteContext={siteContext}
          />
        }
        rail={rail}
      />
      {nextAction ? (
        <>
          <div className={s.bottomBarSpacer} />
          <div className={s.bottomBar}>{nextActionForm}</div>
        </>
      ) : null}
    </>
  );
}
