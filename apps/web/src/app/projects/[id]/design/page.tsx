import Link from "next/link";
import { isTier1WrightsTerrace } from "@workstream/domain";
import { requireProject } from "../../../../lib/project-guard";
import {
  getDesign,
  getDesignCanvas,
  getEnvelopeBrief,
  getSurvey,
  listCostings,
} from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import {
  runDesignAction,
  runDevelopFromSketchAction,
  runSketchCostingAction,
} from "../../../actions";
import { NotFoundPage, ProjectMasthead } from "../ProjectShell";
import { PipelineActionForm } from "../../../../components/PipelineActionForm";
import { QuoteWorkflowSteps } from "../../../../components/QuoteWorkflowSteps";
import { EnvelopeBriefPanel } from "../../../../components/EnvelopeBriefPanel";
import { DesignProposalView } from "../../../../components/DesignProposalView";

export const dynamic = "force-dynamic";

export default async function DesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const [survey, design, canvas, costings] = await Promise.all([
    getSurvey(id),
    getDesign(id),
    getDesignCanvas(id),
    listCostings(id).catch(() => []),
  ]);
  const hasCanvas = (canvas?.placements?.length ?? 0) > 0;
  const envelope =
    survey && hasCanvas ? await getEnvelopeBrief(id) : null;
  const tier1 = isTier1WrightsTerrace(project.address);
  const aerialUri = survey?.aerial_uri ?? null;

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="design" />

      <h1 className={s.headline}>Design</h1>
      <p className={s.lede}>
        Back-of-envelope flow: rough sketch on the aerial, ballpark budget and
        planning flags (tree root protection, council stormwater, heritage), then
        AI develops the design from your layout.
      </p>

      {envelope && hasCanvas && (
        <EnvelopeBriefPanel projectId={id} envelope={envelope} />
      )}

      {survey && (
        <QuoteWorkflowSteps
          projectId={id}
          hasSurvey={!!survey}
          hasCanvas={hasCanvas}
          hasDesign={!!design}
          hasCosting={costings.length > 0}
        />
      )}

      <div className={s.actionBar}>
        {!survey ? (
          <button type="button" className={s.btn} disabled>
            Run survey first
          </button>
        ) : (
          <>
            <Link href={`/projects/${id}/design/studio`} className={s.btn}>
              Open design studio
            </Link>
            <PipelineActionForm
              projectId={id}
              action={runSketchCostingAction}
              label="Envelope estimate"
              pendingLabel="Estimating…"
              successMessage="Sketch estimate ready"
              disabled={!hasCanvas}
            />
            <PipelineActionForm
              projectId={id}
              action={runDevelopFromSketchAction}
              label={design ? "Re-develop from sketch" : "Develop from sketch"}
              pendingLabel="Developing…"
              successMessage="Pipeline started"
              disabled={!hasCanvas}
              redirectToProcessing
            />
            <PipelineActionForm
              projectId={id}
              action={runDesignAction}
              label="Design only (no pipeline)"
              pendingLabel="Designing…"
              successMessage="Design complete"
            />
          </>
        )}
        {design && (
          <span className={`${s.pill} ${s.pillInfo}`}>
            Version {design.version} · {design.mode}
          </span>
        )}
        {design && (
          <span className={`${s.pill} ${s.pillAccent}`}>
            {design.proposal.estimated_complexity}
          </span>
        )}
      </div>

      {!design ? (
        <div className={s.empty}>
          No design yet. Run the survey first, then generate a design.
        </div>
      ) : (
        <DesignProposalView design={design} aerialUri={aerialUri} tier1={tier1} />
      )}
    </main>
  );
}
