import { requireProject } from "../../../../lib/project-guard";
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
} from "../../../../lib/api";
import { loadOptional } from "../../../../lib/load-optional";
import { resolveProjectNextAction } from "../../../../lib/project-next-action";
import s from "../../../../styles/app.module.css";
import {
  runAuditAction,
  runCostingAction,
  runDesignAction,
  runOutputAction,
  runSurveyAction,
} from "../../../actions";
import { NotFoundPage } from "../ProjectShell";
import {
  PipelineContent,
  ProjectPipelineShell,
} from "../../../../components/ProjectPipelineShell";
import { PipelineActionForm } from "../../../../components/PipelineActionForm";
import { PipelineHubView } from "../../../../components/PipelineHubView";
import { getIntegrationHub } from "../../../../lib/api";

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
    survey != null ? await getEnvelopeBrief(id).catch(() => null) : null;

  const quoteOutput = outputs.find((o) => o.kind === "quote");

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

  const nextAction = resolveProjectNextAction({
    survey,
    design,
    costings,
    audit,
    outputs,
    runSurveyAction,
    runDesignAction,
    runCostingAction,
    runAuditAction,
    runOutputAction,
  });

  return (
    <ProjectPipelineShell
      project={project}
      active="overview"
      variant={survey ? "immersive" : "content"}
    >
      {survey ? (
        <PipelineHubView
          project={project}
          projectId={id}
          survey={survey}
          siteContext={siteContext}
          design={design}
          costings={costings}
          audit={audit}
          outputs={outputs}
          tasks={tasks}
          recordings={recordings}
          canvas={canvas}
          activity={activity}
          weather={weather}
          envelope={envelope}
          loadFailures={loadFailures}
          quoteOutput={quoteOutput}
          lastCrmDetail={lastCrmDetail}
          nextAction={nextAction}
        />
      ) : (
        <PipelineContent>
          <p className={s.lede}>
            Run the survey first — the aerial site plan unlocks the pipeline hub and
            design studio.
          </p>
          <div className={s.actionBar}>
            <PipelineActionForm
              projectId={id}
              action={runSurveyAction}
              label="Run survey"
              pendingLabel="Running survey…"
              successMessage="Survey complete"
            />
          </div>
        </PipelineContent>
      )}
    </ProjectPipelineShell>
  );
}
