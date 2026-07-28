import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  isDesignLifecyclePhase,
  isSeedSurveyLot,
  resolveOutdoorAreaM2,
  suggestPhaseFromProjectStatus,
} from "@workstream/domain";
import { HandoffDesignStudio } from "../../../components/canvas/handoff/HandoffDesignStudio";
import {
  getCadastralTitle,
  getDesignCanvas,
  getProject,
  getSurvey,
  listOutputs,
} from "../../../lib/api";
import { requireSignedIn } from "../../../lib/auth";
import {
  resolveCanvasMode,
  type CanvasProgress,
} from "../../../lib/canvas-mode";
import type { StudioMode } from "../../../components/canvas/handoff/studioCatalog";

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
  searchParams: Promise<{ mode?: string }>;
}) {
  await requireSignedIn();
  const { id } = await params;
  const sp = await searchParams;
  const [project, survey, canvas, outputs, titleBlock] = await Promise.all([
    getProject(id),
    getSurvey(id).catch(() => null),
    getDesignCanvas(id).catch(() => null),
    listOutputs(id).catch(() => []),
    getCadastralTitle(id).catch(() => null),
  ]);

  if (!project) notFound();

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

  return (
    <Suspense fallback={null}>
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
  );
}
