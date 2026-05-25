import Link from "next/link";
import { isTier1WrightsTerrace } from "@workstream/domain";
import { requireProject } from "../../../../../lib/project-guard";
import {
  getDesign,
  getDesignCanvas,
  getEnvelopeBrief,
  getSurvey,
  listCostings,
} from "../../../../../lib/api";
import s from "../../../../../styles/app.module.css";
import {
  runDesignAction,
  runDevelopFromSketchAction,
  runSketchCostingAction,
} from "../../../../actions";
import { NotFoundPage } from "../../ProjectShell";
import {
  PipelineContent,
  ProjectPipelineShell,
} from "../../../../../components/ProjectPipelineShell";
import { PipelineActionForm } from "../../../../../components/PipelineActionForm";
import { EnvelopeBriefPanel } from "../../../../../components/EnvelopeBriefPanel";
import { DesignProposalView } from "../../../../../components/DesignProposalView";
import { Tier1DevelopHero, Tier1SavingsLedger } from "../../../../../components/tier1";

export const dynamic = "force-dynamic";

export default async function DesignDevelopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const survey = await getSurvey(id);
  const [design, canvas, costings] = await Promise.all([
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
    <ProjectPipelineShell
      project={project}
      active="design"
      sectionLabel="Develop & estimate"
    >
      <PipelineContent>

      <p className={s.meta}>
        <Link href={`/projects/${id}/design`}>← Back to sketch</Link>
      </p>

      <h1 className={s.headline}>Develop & estimate</h1>
      <p className={s.lede}>
        Back-of-envelope budget and planning flags, then AI develops the design
        from your sketch.
      </p>

      {tier1 ? <Tier1DevelopHero address={project.address} /> : null}
      {tier1 ? <Tier1SavingsLedger /> : null}

      {!survey ? (
        <div className={s.actionBar}>
          <Link href={`/projects/${id}/survey`} className={s.btn}>
            Complete survey first
          </Link>
        </div>
      ) : (
        <section id="develop" aria-labelledby="develop-heading">
          {envelope && hasCanvas && (
            <EnvelopeBriefPanel projectId={id} envelope={envelope} />
          )}

          <div id="envelope-estimate" className={s.actionBar}>
            <PipelineActionForm
              projectId={id}
              action={runSketchCostingAction}
              label="Envelope estimate"
              pendingLabel="Estimating…"
              successMessage="Sketch estimate ready"
              disabled={!hasCanvas}
            />
            {!hasCanvas && (
              <Link href={`/projects/${id}/design`} className={s.btn}>
                Sketch on aerial first
              </Link>
            )}
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
              No AI design yet. Sketch on the aerial, then run develop from
              sketch.
            </div>
          ) : (
            <DesignProposalView
              design={design}
              aerialUri={aerialUri}
              tier1={tier1}
            />
          )}
        </section>
      )}
      </PipelineContent>
    </ProjectPipelineShell>
  );
}
