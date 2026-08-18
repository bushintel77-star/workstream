import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  isDesignLifecyclePhase,
  isSeedSurveyLot,
  resolveOutdoorAreaM2,
  suggestPhaseFromProjectStatus,
} from "@workstream/domain";
import { HandoffDesignStudio } from "../../../components/canvas/handoff/HandoffDesignStudio";
import { StudioSkeleton } from "../../../components/canvas/handoff/StudioSkeleton";
import { WebGLStudioPreview } from "../../../components/canvas/webgl/WebGLStudioPreview";
import type { PctPoint } from "../../../components/canvas/webgl/coordTransform";
import {
  getCadastralTitle,
  getAudit,
  getDesignCanvas,
  getDesign,
  getCadDocumentApi,
  getProject,
  getSurvey,
  listCostings,
  listOutputs,
} from "../../../lib/api";
import { requireSignedIn } from "../../../lib/auth";
import {
  resolveCanvasMode,
  webglStudioSupportsMode,
  type CanvasProgress,
} from "../../../lib/canvas-mode";
import { resolveProjectNextAction } from "../../../lib/project-next-action";
import type { StudioMode } from "../../../components/canvas/handoff/studioCatalog";
import {
  runAuditAction,
  runCostingAction,
  runDesignAction,
  runOutputAction,
  runSurveyAction,
} from "../../../app/actions";
import { SubmitButton } from "../../../components/SubmitButton";
import { KitButton } from "../../../components/ui/kit";
import styles from "./project.module.css";

export const dynamic = "force-dynamic";

function resolveAreaM2(args: {
  titleLotM2: number | null | undefined;
  titleHouseM2: number | null | undefined;
  survey: Awaited<ReturnType<typeof getSurvey>> | null;
  canvas: Awaited<ReturnType<typeof getDesignCanvas>> | null;
}): number | null {
  const survey = args.survey;
  const frame = args.canvas?.site_frame;
  const seedLot = survey
    ? isSeedSurveyLot({
      lot_area_m2: survey.lot_area_m2,
      measurements: survey.measurements,
    })
    : false;
  const resolved = resolveOutdoorAreaM2({
    garden_area_m2: survey?.garden_area_m2,
    lot_area_m2: args.titleLotM2 ?? survey?.lot_area_m2,
    house_area_m2: args.titleHouseM2 ?? survey?.house_area_m2,
    seedLot,
    boundary: frame?.boundary,
    building: frame?.building,
    scaleM: frame?.board_width_m ?? null,
  });
  return resolved.outdoor_m2;
}

export default async function ProjectCanvasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    mode?: string;
    webgl?: string;
    svg?: string;
    tool?: string;
  }>;
}) {
  await requireSignedIn();
  const { id } = await params;
  const sp = await searchParams;
  const project = await getProject(id);
  if (!project) notFound();

  /* Canvas hydrate must fail closed — treating network/5xx as "empty board"
   * lets autosave overwrite a real drawing with []. Survey/title/outputs
   * remain best-effort for first paint. */
  const canvas = await getDesignCanvas(id);
  const [survey, outputs, titleBlock] = await Promise.all([
    getSurvey(id).catch(() => null),
    listOutputs(id).catch(() => []),
    getCadastralTitle(id).catch(() => null),
  ]);
  const [design, costings, audit] = await Promise.all([
    getDesign(id).catch(() => null),
    listCostings(id).catch(() => []),
    getAudit(id).catch(() => null),
  ]);
  const cad = await getCadDocumentApi(id).catch(() => null);

  const quoteOut = outputs.find((o) => o.kind === "quote") ?? null;
  const progress: CanvasProgress = {
    hasAerial: Boolean(survey?.aerial_uri),
    hasSketch: (canvas?.strokes?.length ?? 0) > 0,
    hasCad:
      (canvas?.placements?.length ?? 0) > 0 ||
      Boolean(canvas?.site_frame?.boundary?.length),
    hasQuote: Boolean(quoteOut),
  };
  /** Clamp locked deep-links before first paint — avoids cad→survey flash. */
  const initialMode = resolveCanvasMode(sp.mode, progress) as StudioMode;
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

  /** WebGL studio is the default mount for every mode (all 8 render
   * natively on the GL surface per canvas-mode.webglStudioSupportsMode).
   * ?svg=1 forces the legacy SVG studio (deep fallback); ?webgl=1 forces
   * the WebGL studio (the e2e mount contract); ?tool=sketch arms the WebGL
   * sketch surface directly. */
  const webglPreview =
    sp.svg !== "1" &&
    (sp.webgl === "1" ||
      webglStudioSupportsMode(initialMode) ||
      sp.tool === "sketch");
  const frame = canvas?.site_frame ?? null;
  const webglScaleM = frame?.board_width_m ?? 110;
  const webglBoardAspect =
    frame && frame.boundary && frame.boundary.length > 0
      ? (() => {
          const ys = frame.boundary!.map((p) => p.y_pct);
          const xs = frame.boundary!.map((p) => p.x_pct);
          const w = Math.max(...xs) - Math.min(...xs) || 100;
          const h = Math.max(...ys) - Math.min(...ys) || 100;
          return h / w;
        })()
      : 1;

  if (webglPreview) {
    return (
      <main aria-label="Design canvas" style={{ position: "fixed", inset: 0 }}>
        <WebGLStudioPreview
          projectId={id}
          initialSketchMode={sp.tool === "sketch"}
          initialMode={
            webglStudioSupportsMode(initialMode) ? initialMode : "sketch"
          }
          progress={progress}
          scaleM={webglScaleM}
          boardAspect={webglBoardAspect}
          boundaryPct={
            (frame?.boundary?.map((p) => ({ x: p.x_pct, y: p.y_pct })) as
              | PctPoint[]
              | undefined) ?? []
          }
          buildingPct={
            frame?.building
              ? (frame.building.map((p) => ({ x: p.x_pct, y: p.y_pct })) as PctPoint[])
              : undefined
          }
          easementsPct={
            frame?.easements?.map((ring) =>
              ring.map((p) => ({ x: p.x_pct, y: p.y_pct })),
            )
          }
          lat={project.lat ?? undefined}
          lng={project.lng ?? undefined}
          projectAddress={project.address}
          initialStrokes={canvas?.strokes ?? []}
          placements={canvas?.placements ?? []}
          initialFeatures={canvas?.features ?? []}
          photoElevations={canvas?.photo_elevations ?? []}
          bydaAssets={frame?.byda_assets ?? []}
          constructionTrenches={canvas?.construction_trenches ?? []}
          irrigationZones={canvas?.irrigation_zones ?? []}
          levels={frame?.levels ?? []}
          keylessOverlays={frame?.keyless_overlays ?? []}
          neighbourBuildings={frame?.neighbour_buildings ?? []}
          outdoorM2={
            resolveAreaM2({
              titleLotM2: titleBlock?.lotAreaM2,
              titleHouseM2: titleBlock?.houseAreaM2,
              survey,
              canvas,
            }) ?? 0
          }
          hasQuote={Boolean(quoteOut)}
          quotePortalUri={quoteOut?.uri ?? null}
          initialCadGhostCount={cad?.ghost_count ?? null}
        />
      </main>
    );
  }

  return (
    <main aria-label="Design canvas">
      <section className={styles.pipelineBanner} aria-label="Pipeline status">
        <div className={styles.pipelineBannerCopy}>
          <p className={styles.pipelineKicker}>Backend pipeline</p>
          <h1 className={styles.pipelineTitle}>
            {nextAction ? nextAction.label : "Pipeline complete"}
          </h1>
          <p className={styles.pipelineBody}>
            {nextAction
              ? "This step is driven by the current survey, design, costing, audit, and output state."
              : "The current project has moved through the visible backend stages. Open outputs to review the generated deliverables."}
          </p>
        </div>
        {nextAction ? (
          <form action={nextAction.action} className={styles.pipelineActions}>
            <input type="hidden" name="projectId" value={id} />
            {nextAction.kind ? (
              <input type="hidden" name="kind" value={nextAction.kind} />
            ) : null}
            <SubmitButton
              pendingLabel={nextAction.pending}
              className={styles.pipelineButton}
            >
              {nextAction.label}
            </SubmitButton>
          </form>
        ) : (
          <KitButton
            as="a"
            href={`/projects/${id}/outputs`}
            variant="secondary"
            size="md"
            className={styles.pipelineButton}
          >
            Open outputs
          </KitButton>
        )}
      </section>
      <Suspense fallback={<StudioSkeleton />}>
        <HandoffDesignStudio
          projectId={id}
          projectAddress={project.address}
          projectLat={project.lat ?? null}
          projectLng={project.lng ?? null}
          aerialUri={survey?.aerial_uri ?? null}
          areaM2={resolveAreaM2({
            titleLotM2: titleBlock?.lotAreaM2,
            titleHouseM2: titleBlock?.houseAreaM2,
            survey,
            canvas,
          })}
          initialMode={initialMode}
          initialPlacements={canvas?.placements ?? []}
          initialStrokes={canvas?.strokes ?? []}
          initialSiteFrame={canvas?.site_frame ?? null}
          initialIrrigationZones={canvas?.irrigation_zones ?? []}
          initialConstructionTrenches={canvas?.construction_trenches ?? []}
          initialAnnotations={canvas?.annotations ?? []}
          initialImageLayers={canvas?.image_layers ?? []}
          initialFeatures={canvas?.features ?? []}
          initialPresentationPack={canvas?.presentation_pack ?? null}
          initialLifecyclePhase={
            isDesignLifecyclePhase(canvas?.lifecycle_phase)
              ? canvas.lifecycle_phase
              : suggestPhaseFromProjectStatus(project.status)
          }
          hasQuote={Boolean(quoteOut)}
          quotePortalUri={quoteOut?.uri ?? null}
          initialTitleBlock={titleBlock}
        />
      </Suspense>
    </main>
  );
}
