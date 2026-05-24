import Link from "next/link";
import { isTier1WrightsTerrace } from "@workstream/domain";
import { requireProject } from "../../../../lib/project-guard";
import {
  getDesign,
  getDesignCanvas,
  getEnvelopeBrief,
  getSurvey,
  listCatalogSymbols,
  listCostings,
  listRateCard,
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
import { DesignStudioSection } from "./DesignStudioSection";

export const dynamic = "force-dynamic";

export default async function DesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const survey = await getSurvey(id);
  const [design, canvas, costings, symbols, rateCard] = await Promise.all([
    getDesign(id),
    getDesignCanvas(id),
    listCostings(id).catch(() => []),
    survey ? listCatalogSymbols() : Promise.resolve([]),
    survey ? listRateCard() : Promise.resolve([]),
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
        Concept sketch on the survey aerial — place Curtis assets, mass planting,
        irrigation, and live schedule. Save before opening outputs.
      </p>

      {!survey ? (
        <div className={s.actionBar}>
          <Link href={`/projects/${id}/survey`} className={s.btn}>
            Complete survey first
          </Link>
        </div>
      ) : (
        <>
          <QuoteWorkflowSteps
            projectId={id}
            hasSurvey={!!survey}
            hasCanvas={hasCanvas}
            hasDesign={!!design}
            hasCosting={costings.length > 0}
          />

          <DesignStudioSection
            projectId={id}
            aerialUri={survey.aerial_uri}
            lotRing={survey.title_polygon.coordinates[0] as [number, number][]}
            symbols={symbols}
            rateCard={rateCard}
            canvas={canvas}
          />

          <section id="develop" aria-labelledby="develop-heading">
            <h2 id="develop-heading" className={s.sectionHeading}>
              Develop & estimate
            </h2>
            <p className={s.meta}>
              Back-of-envelope budget and planning flags, then AI develops the
              design from your sketch.
            </p>

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
        </>
      )}
    </main>
  );
}
