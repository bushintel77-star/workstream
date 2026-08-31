import { notFound } from "next/navigation";
import {
  daylightHoursAt,
  dayOfYearFrom,
  isSeedSurveyLot,
  resolveOutdoorAreaM2,
} from "@workstream/domain";
import { WebGLStudioPreview } from "../../../components/canvas/webgl/WebGLStudioPreview";
import type { PctPoint } from "../../../components/canvas/webgl/coordTransform";
import {
  getCadastralTitle,
  getDesignCanvas,
  getCadDocumentApi,
  getProject,
  getSurvey,
  listOutputs,
} from "../../../lib/api";
import { requireSignedIn } from "../../../lib/auth";
import {
  resolveCanvasMode,
  webglStudioSupportsMode,
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
  searchParams: Promise<{
    mode?: string;
    webgl?: string;
    svg?: string;
    tool?: string;
    guide?: string;
    e2eStudioError?: string;
  }>;
}) {
  await requireSignedIn();
  const { id } = await params;
  const sp = await searchParams;
  if (process.env.NODE_ENV !== "production" && sp.e2eStudioError === "1") {
    throw new Error("E2E studio error boundary probe");
  }
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
  const cad = await getCadDocumentApi(id).catch(() => null);

  const quoteOut = outputs.find((o) => o.kind === "quote") ?? null;
  const progress: CanvasProgress = {
    /* The aerial gate is really "site truth captured": a Vicmap-traced
     * title boundary is the digital minimum, so boundary presence unlocks
     * the stage even when no aerial photo exists (survey.aerial_uri is
     * the legacy field name for the same stage). */
    hasAerial:
      Boolean(survey?.aerial_uri) ||
      (canvas?.site_frame?.boundary?.length ?? 0) >= 3,
    hasSketch: (canvas?.strokes?.length ?? 0) > 0,
    hasCad:
      (canvas?.placements?.length ?? 0) > 0 ||
      Boolean(canvas?.site_frame?.boundary?.length),
    hasQuote: Boolean(quoteOut),
  };
  /** Clamp locked deep-links before first paint — avoids cad→survey flash.
   *  `?guide=1` forces Survey for first-run onboarding: the UnifiedPanel
   *  shows the setup checklist there, so new users land on the guided path. */
  const initialMode = (
    sp.guide === "1" ? "survey" : resolveCanvasMode(sp.mode, progress)
  ) as StudioMode;

  /** The WebGL studio is the only canvas mount. The legacy SVG studio
   * (?svg=1) was retired 2026-08-19 — see ONBOARDING.md. */
  const frame = canvas?.site_frame ?? null;
  const webglScaleM = frame?.board_width_m ?? 110;
  // The board is a SQUARE: site_truth_import fits the site with a uniform
  // scale (8% margin), so board_width_m is the metres per 100 board-% on
  // BOTH axes and the boundary's pct SHAPE already carries the lot's true
  // aspect. Deriving an aspect from the bbox (h/w) squashed elongated lots
  // ~5x in the world (a 350×71 m parcel rendered 350×14 m — live 2026-08-25,
  // 10 Gisborne St) while square lots hid the defect. Aspect is 1 by law.
  const webglBoardAspect = 1;

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
        initialCanvases={canvas?.canvases ?? []}
        initialSetbackLines={canvas?.setback_lines ?? []}
        initialBuildingFootprints={canvas?.building_footprints ?? []}
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
        siteMeta={{
          titleRef: titleBlock?.parcelRef ?? null,
          lga: titleBlock?.councilLabel ?? null,
          lotAreaM2: titleBlock?.lotAreaM2 ?? null,
          // Real solar geometry — the unshaded daylight window at the site
          // for today's date (canopy-adjusted exposure lives in the flora ring).
          sunHours:
            project.lat != null
              ? daylightHoursAt(project.lat, dayOfYearFrom(new Date()))
              : null,
        }}
        northBearingDeg={frame?.north_bearing ?? null}
      />
    </main>
  );
}
