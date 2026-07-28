import type { FastifyInstance } from "fastify";
import type {
  CatalogSymbol,
  DesignCanvas,
  Project,
  Survey,
} from "@workstream/contracts";
import {
  buildAssistSiteIntel,
  buildStudioBoardContext,
  isDesignLifecyclePhase,
  isSeedSurveyLot,
  preferredCosting,
  resolveOutdoorAreaM2,
  suggestPhaseFromProjectStatus,
  type BoardContext,
  type LngLat,
} from "@workstream/domain";
import { groundSpanFromSurvey } from "./cad-ground";

type Store = FastifyInstance["store"];

export type ProjectBoard = {
  /** BoardContext v1 — the whole board at full depth. */
  context: BoardContext;
  canvas: DesignCanvas | null;
  survey: Survey | null;
  symbols: CatalogSymbol[];
  span: ReturnType<typeof groundSpanFromSurvey> | null;
  /** null when Vicmap and the traced boundary both absent — never invented. */
  outdoorM2: number | null;
  easementCount: number;
  serviceCount: number;
  intel: ReturnType<typeof buildAssistSiteIntel>;
};

/**
 * Load every durable artefact the board reasons over and assemble it into
 * BoardContext v1. One definition of "the board" for every route that needs it
 * — assist, findings, and whatever reuses the context next.
 */
export async function loadProjectBoard(
  store: Store,
  ownerId: string,
  project: Project,
): Promise<ProjectBoard> {
  const [survey, canvas, symbols, design, costings, rateCard] =
    await Promise.all([
      store.getSurvey(ownerId, project.id),
      store.getDesignCanvas(ownerId, project.id),
      store.listCatalogSymbols(ownerId),
      store.getDesign(ownerId, project.id),
      store.listCostings(ownerId, project.id),
      store.listRateCard(ownerId),
    ]);

  const span = survey ? groundSpanFromSurvey(survey) : null;
  const frame = canvas?.site_frame;
  const easementCount =
    frame?.easements?.filter((r) => r.length >= 3).length ?? 0;
  const serviceCount = frame?.services?.length ?? 0;

  const titleRing = survey?.title_polygon?.coordinates?.[0] as
    | LngLat[]
    | undefined;
  const seedLot = survey
    ? isSeedSurveyLot({
        lot_area_m2: survey.lot_area_m2,
        measurements: survey.measurements,
      })
    : false;
  const scaleM =
    frame?.board_width_m ?? span?.width_m ?? null;
  const resolved = resolveOutdoorAreaM2({
    garden_area_m2: survey?.garden_area_m2,
    lot_area_m2: survey?.lot_area_m2,
    house_area_m2: survey?.house_area_m2,
    seedLot,
    titleRing: titleRing && titleRing.length >= 3 ? titleRing : null,
    houseRing:
      survey?.house_polygon?.coordinates?.[0] &&
      survey.house_polygon.coordinates[0].length >= 3
        ? (survey.house_polygon.coordinates[0] as LngLat[])
        : null,
    boundary: frame?.boundary,
    building: frame?.building,
    scaleM,
  });
  const outdoorM2 = resolved.outdoor_m2;

  const intel = buildAssistSiteIntel({
    outdoorM2: outdoorM2 ?? 0,
    placements: canvas?.placements ?? [],
    boundary: frame?.boundary,
    lat: project.lat ?? undefined,
    lng: project.lng ?? undefined,
    scaleM: scaleM ?? undefined,
  });

  const lifecyclePhase = isDesignLifecyclePhase(canvas?.lifecycle_phase)
    ? canvas.lifecycle_phase
    : suggestPhaseFromProjectStatus(project.status);

  const context = buildStudioBoardContext({
    project,
    canvas,
    survey,
    symbols,
    scaleM,
    outdoorM2,
    sunHours: intel.sun_hours ?? null,
    shadeSummary: intel.shade_summary ?? null,
    costing: preferredCosting(costings),
    rateCard,
    mode: design?.mode ?? null,
    phase: lifecyclePhase,
    seedLot,
  });

  return {
    context,
    canvas,
    survey,
    symbols,
    span,
    outdoorM2,
    easementCount,
    serviceCount,
    intel,
  };
}
