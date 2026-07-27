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
  preferredCosting,
  type BoardContext,
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
  outdoorM2: number;
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
  const outdoorM2 =
    survey?.garden_area_m2 ??
    survey?.lot_area_m2 ??
    (span ? span.width_m * span.height_m * 0.55 : 180);

  const intel = buildAssistSiteIntel({
    outdoorM2,
    placements: canvas?.placements ?? [],
    boundary: frame?.boundary,
    lat: project.lat ?? undefined,
    lng: project.lng ?? undefined,
    scaleM: span?.width_m,
  });

  const context = buildStudioBoardContext({
    project,
    canvas,
    survey,
    symbols,
    scaleM: span?.width_m ?? null,
    outdoorM2,
    sunHours: intel.sun_hours ?? null,
    shadeSummary: intel.shade_summary ?? null,
    costing: preferredCosting(costings),
    rateCard,
    mode: design?.mode ?? null,
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
