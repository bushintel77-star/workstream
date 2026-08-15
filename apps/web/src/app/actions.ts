"use server";

import { revalidatePath } from "next/cache";
import {
  createOverrideApi,
  createProjectApi,
  geocodePreviewApi,
  geocodeSearchApi,
  createTaskApi,
  listTasks,
  deleteProjectApi,
  restoreProjectApi,
  getAudit,
  getDesign,
  getProject,
  listProjects,
  getSurvey,
  saveDesignCanvasApi,
  type CatalogPlacement,
  type DesignCanvas,
  listCostings,
  listRecordings,
  runAudit,
  runCosting,
  runDesign,
  runFullPipeline,
  runSketchCosting,
  runDevelopFromSketchPipeline,
  runOutput,
  runSurvey,
  updateTaskStatusApi,
  type OutputKind,
  type TaskPriority,
  type TaskStatus,
  getQuoteDocApi,
  upsertQuoteDocApi,
} from "../lib/api";
import type { UpsertQuoteDocInput } from "@workstream/contracts";

function wrapApiError(err: unknown, fallback: string): Error {
  if (!(err instanceof Error)) return new Error(fallback);
  const m = err.message;
  if (
    /Couldn't reach|timed out|fetch failed|ECONNREFUSED|ENOTFOUND|API 5\d\d/i.test(
      m,
    )
  ) {
    return new Error(fallback);
  }
  const apiError = m.match(/"error"\s*:\s*"([^"]{1,160})"/);
  if (apiError?.[1] && !/internal error/i.test(apiError[1])) {
    return new Error(apiError[1]);
  }
  if (/API 4\d\d/.test(m) || m.length > 160 || m.includes("<")) {
    return new Error(fallback);
  }
  return new Error(m || fallback);
}

function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/* -- Projects --------------------------------------------------------- */

export async function listProjectsAction() {
  try {
    return await listProjects();
  } catch (err) {
    throw wrapApiError(err, "Could not load sites");
  }
}

export async function geocodeSearchAction(query: string) {
  try {
    return await geocodeSearchApi(query);
  } catch {
    return [];
  }
}

function parseProjectCoords(formData: FormData) {
  const latRaw = formData.get("lat");
  const lngRaw = formData.get("lng");
  const lat =
    latRaw != null && String(latRaw).length > 0
      ? Number(latRaw)
      : undefined;
  const lng =
    lngRaw != null && String(lngRaw).length > 0
      ? Number(lngRaw)
      : undefined;
  return {
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
  };
}

export async function geocodePreviewAction(lat: number, lng: number) {
  try {
    return await geocodePreviewApi(lat, lng);
  } catch (err) {
    throw wrapApiError(err, "Could not load aerial preview");
  }
}

/** Create project, run survey, return id + Vicmap lot for locate loader. */
export async function createProjectWithSurveyAction(formData: FormData) {
  const address = String(formData.get("address") ?? "").trim();
  if (address.length < 5) {
    throw new Error("Enter a valid street address");
  }
  const { lat, lng } = parseProjectCoords(formData);
  try {
    const project = await createProjectApi({ address, lat, lng });
    const survey = await runSurvey(project.id);
    revalidatePath("/");
    revalidatePath(`/projects/${project.id}`);
    revalidatePath(`/projects/${project.id}/survey`);
    const ring = survey.title_polygon?.coordinates?.[0] as
      | [number, number][]
      | undefined;
    return {
      projectId: project.id,
      aerialUri: survey.aerial_uri,
      titleRing: ring && ring.length >= 4 ? ring : null,
      lotAreaM2: survey.lot_area_m2 ?? null,
    };
  } catch (err) {
    throw wrapApiError(err, "Could not create project");
  }
}

export async function createProjectAction(formData: FormData) {
  const address = String(formData.get("address") ?? "").trim();
  if (address.length < 5) {
    throw new Error("Enter a full site address (at least 5 characters)");
  }
  const { lat, lng } = parseProjectCoords(formData);
  try {
    await createProjectApi({ address, lat, lng });
  } catch (err) {
    throw wrapApiError(err, "Could not create project");
  }
  revalidatePath("/");
}

export async function pollProjectProgressAction(projectId: string) {
  if (!projectId) {
    throw new Error("Missing project");
  }
  try {
    const [project, recordings, survey, design, costings, audit] =
      await Promise.all([
        getProject(projectId),
        listRecordings(projectId),
        getSurvey(projectId),
        getDesign(projectId),
        listCostings(projectId),
        getAudit(projectId),
      ]);
    if (!project) {
      throw new Error("Project not found");
    }
    const ready =
      audit != null ||
      project.status === "survey_review" ||
      project.status === "design_review" ||
      project.status === "cost_review" ||
      project.status === "audit" ||
      project.status === "outputs" ||
      project.status === "complete";

    return {
      status: project.status,
      hasTranscript: recordings.some((r) => !!r.transcript),
      hasSurvey: survey != null,
      hasDesign: design != null,
      hasCosting: costings.length > 0,
      hasAudit: audit != null,
      ready,
    };
  } catch (err) {
    throw wrapApiError(err, "Could not refresh progress");
  }
}

export async function deleteProjectAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing project");
  try {
    await deleteProjectApi(id);
  } catch (err) {
    throw wrapApiError(err, "Could not delete project");
  }
  revalidatePath("/");
}

export async function restoreProjectAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing project");
  try {
    await restoreProjectApi(id);
  } catch (err) {
    throw wrapApiError(err, "Could not restore project");
  }
  revalidatePath("/");
}

/* -- Pipeline runners ------------------------------------------------- */

export async function runSurveyAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) throw new Error("Missing project");
  try {
    await runSurvey(projectId);
  } catch (err) {
    throw wrapApiError(err, "Survey failed");
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/survey`);
}

export async function saveDesignCanvasAction(
  projectId: string,
  placements: CatalogPlacement[],
  strokes: DesignCanvas["strokes"] = [],
  irrigationZones: DesignCanvas["irrigation_zones"] = [],
  annotations?: DesignCanvas["annotations"],
  imageLayers?: DesignCanvas["image_layers"],
  siteFrame?: DesignCanvas["site_frame"],
  features?: DesignCanvas["features"],
  constructionTrenches?: DesignCanvas["construction_trenches"],
) {
  if (!projectId.trim()) {
    throw new Error("Missing project — cannot save site plan");
  }
  const { UpsertDesignCanvasSchema } = await import("@workstream/contracts");
  const parsed = UpsertDesignCanvasSchema.safeParse({
    placements,
    strokes,
    irrigation_zones: irrigationZones,
    ...(annotations != null ? { annotations } : {}),
    ...(imageLayers != null ? { image_layers: imageLayers } : {}),
    ...(siteFrame != null ? { site_frame: siteFrame } : {}),
    ...(features != null ? { features } : {}),
    ...(constructionTrenches != null
      ? { construction_trenches: constructionTrenches }
      : {}),
  });
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Site plan failed validation",
    );
  }
  try {
    const result = await saveDesignCanvasApi(
      projectId,
      parsed.data.placements,
      parsed.data.strokes ?? [],
      parsed.data.irrigation_zones ?? [],
      parsed.data.annotations,
      parsed.data.image_layers,
      parsed.data.site_frame,
      parsed.data.features,
      parsed.data.construction_trenches,
    );
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/design`);
    revalidatePath(`/projects/${projectId}/design/develop`);
    revalidatePath(`/projects/${projectId}/design/studio`);
    revalidatePath(`/projects/${projectId}/costing`);
    revalidatePath(`/projects/${projectId}/overview`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "Failed to save site plan");
  }
}

export async function formalizeSketchToCadAction(
  projectId: string,
  body: import("@workstream/contracts").SketchToCadRequest,
) {
  const { formalizeSketchToCadApi } = await import("../lib/api");
  try {
    return await formalizeSketchToCadApi(projectId, body);
  } catch (err) {
    throw wrapApiError(err, "AI sketch → CAD translation failed");
  }
}

export async function scanDesignGhostsAction(projectId: string) {
  const { scanDesignGhostsApi } = await import("../lib/api");
  try {
    return await scanDesignGhostsApi(projectId);
  } catch (err) {
    throw wrapApiError(err, "AI site scan failed");
  }
}

export async function designAssistAction(projectId: string, message: string) {
  const { designAssistApi } = await import("../lib/api");
  try {
    return await designAssistApi(projectId, message.trim());
  } catch (err) {
    throw wrapApiError(err, "AI sketch assist failed");
  }
}

/**
 * Cross-artefact board findings. Server action so the studio hook never imports
 * lib/api (Clerk / async_hooks breaks the web Docker build — ref f0239bc).
 */
export async function designFindingsAction(projectId: string) {
  if (!projectId.trim()) {
    throw new Error("Missing project — cannot load board findings");
  }
  const { designFindingsApi } = await import("../lib/api");
  try {
    return await designFindingsApi(projectId);
  } catch (err) {
    throw wrapApiError(err, "Board findings failed");
  }
}

/**
 * Sustainability read-out + export disclaimers over the same board. Server
 * action for the same reason as the findings — the studio hook must never
 * import lib/api (ref f0239bc).
 */
export async function designBoardReportAction(projectId: string) {
  if (!projectId.trim()) {
    throw new Error("Missing project — cannot load the board report");
  }
  const { designBoardReportApi } = await import("../lib/api");
  try {
    return await designBoardReportApi(projectId);
  } catch (err) {
    throw wrapApiError(err, "Board report failed");
  }
}

/** Live twin telemetry — measured samples for the Live telemetry overlay. */
export async function designTelemetryAction(projectId: string) {
  if (!projectId.trim()) {
    throw new Error("Missing project — cannot load telemetry");
  }
  const { designTelemetryApi } = await import("../lib/api");
  try {
    return await designTelemetryApi(projectId);
  } catch (err) {
    throw wrapApiError(err, "Telemetry load failed");
  }
}

export async function ingestDesignTelemetryAction(
  projectId: string,
  body: import("@workstream/contracts").IngestTelemetryRequest,
) {
  if (!projectId.trim()) {
    throw new Error("Missing project — cannot ingest telemetry");
  }
  const { ingestDesignTelemetryApi } = await import("../lib/api");
  try {
    return await ingestDesignTelemetryApi(projectId, body);
  } catch (err) {
    throw wrapApiError(err, "Telemetry ingest failed");
  }
}

/** Open-Meteo forecast for the Env boundary rail weather icons. */
export async function getWeatherAction(projectId: string) {
  if (!projectId.trim()) return null;
  const { getWeather } = await import("../lib/api");
  try {
    return await getWeather(projectId);
  } catch {
    return null;
  }
}

/** Site context — season, sun summary, and council planning badges. */
export async function getSiteContextAction(projectId: string) {
  if (!projectId.trim()) return null;
  const { getSiteContext } = await import("../lib/api");
  try {
    return await getSiteContext(projectId);
  } catch {
    return null;
  }
}

/** Budget envelope brief from the survey (±15/20% bands + planning flags). */
export async function getEnvelopeBriefAction(projectId: string) {
  if (!projectId.trim()) return null;
  const { getEnvelopeBrief } = await import("../lib/api");
  try {
    return await getEnvelopeBrief(projectId);
  } catch {
    return null;
  }
}

/** Vision photo-measurement history for the measurements surface. */
export async function listPhotoMeasurementsAction(projectId: string) {
  if (!projectId.trim()) return [];
  const { listPhotoMeasurements } = await import("../lib/api");
  try {
    return await listPhotoMeasurements(projectId);
  } catch {
    return [];
  }
}

/** Project activity audit trail (deletions, restores, integration changes). */
export async function listProjectActivityAction(projectId: string) {
  if (!projectId.trim()) return [];
  const { listProjectActivity } = await import("../lib/api");
  try {
    return await listProjectActivity(projectId);
  } catch {
    return [];
  }
}

/* -- Workspace license / billing ---------------------------------------- */

/** Workspace license + price configuration (license page). */
export async function getWorkspaceLicenseAction() {
  const { getWorkspaceLicenseApi } = await import("../lib/api");
  try {
    return await getWorkspaceLicenseApi();
  } catch {
    return null;
  }
}

/** Stripe studio-plan checkout — returns the hosted checkout URL. */
export async function startStudioCheckoutAction() {
  const { startStudioCheckoutApi } = await import("../lib/api");
  return startStudioCheckoutApi();
}

/** Stripe extra-seat checkout — returns the hosted checkout URL. */
export async function startSeatCheckoutAction(extraSeats = 1) {
  const { startSeatCheckoutApi } = await import("../lib/api");
  return startSeatCheckoutApi(extraSeats);
}

/** Add a member to the workspace seat license. */
export async function inviteWorkspaceMemberAction(userId: string) {
  const { inviteWorkspaceMemberApi } = await import("../lib/api");
  try {
    return await inviteWorkspaceMemberApi(userId);
  } catch (err) {
    throw wrapApiError(err, "Could not add member");
  }
}

/** Remove a member from the workspace seat license. */
export async function removeWorkspaceMemberAction(userId: string) {
  const { removeWorkspaceMemberApi } = await import("../lib/api");
  try {
    return await removeWorkspaceMemberApi(userId);
  } catch (err) {
    throw wrapApiError(err, "Could not remove member");
  }
}

/** Architectural title block · Vicmap cadastral for the selected address. */
export async function lookupCadastralTitleAction(
  projectId: string,
  address?: string,
) {
  const { getCadastralTitle } = await import("../lib/api");
  try {
    return await getCadastralTitle(projectId, address);
  } catch (err) {
    throw wrapApiError(err, "Cadastral title lookup failed");
  }
}

/** First-run: seed starter massing, try AI CAD, land operator on the drawing. */
export async function prepareSiteFirstRunAction(projectId: string) {
  if (!projectId) throw new Error("Missing project");
  const { buildFirstRunSeedPlacements } = await import("@workstream/domain");
  const { getDesignCanvas, saveDesignCanvasApi, generateCadApi } =
    await import("../lib/api");
  try {
    let canvas = await getDesignCanvas(projectId);
    if (!canvas?.placements?.length) {
      const seeded = buildFirstRunSeedPlacements();
      const saved = await saveDesignCanvasApi(
        projectId,
        seeded,
        [],
        [],
        [],
      );
      canvas = saved.canvas;
    }

    let mode: "cad" | "sketch" = "sketch";
    let ghostCount = 0;
    let cadResult: Awaited<ReturnType<typeof generateCadApi>> | null = null;
    try {
      cadResult = await generateCadApi(projectId);
      mode = "cad";
      ghostCount = cadResult.ghost_count ?? 0;
    } catch {
      /* CAD may fail without model keys — sketch + live BOM still useful */
      mode = "sketch";
    }

    revalidatePath(`/projects/${projectId}`);
    return {
      mode,
      placementCount: canvas.placements.length,
      ghostCount,
      cad: cadResult,
    };
  } catch (err) {
    throw wrapApiError(err, "Could not prepare site");
  }
}

export async function getOrchestrationAction(projectId: string) {
  const { getOrchestrationApi } = await import("../lib/api");
  try {
    return await getOrchestrationApi(projectId);
  } catch (err) {
    throw wrapApiError(err, "Orchestration world failed");
  }
}

export async function listLeftoversAction() {
  const { listLeftoversApi } = await import("../lib/api");
  try {
    return await listLeftoversApi();
  } catch (err) {
    throw wrapApiError(err, "List leftovers failed");
  }
}

export async function registerLeftoverAction(
  input: import("@workstream/contracts").RegisterLeftoverInput,
) {
  const { registerLeftoverApi } = await import("../lib/api");
  try {
    return await registerLeftoverApi(input);
  } catch (err) {
    throw wrapApiError(err, "Register leftover failed");
  }
}

export async function presentationPackAction(projectId: string) {
  const { presentationPackApi } = await import("../lib/api");
  try {
    const result = await presentationPackApi(projectId);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "Presentation pack failed");
  }
}

export async function getDesignCanvasAction(projectId: string) {
  const { getDesignCanvas } = await import("../lib/api");
  try {
    return await getDesignCanvas(projectId);
  } catch (err) {
    throw wrapApiError(err, "Load design canvas failed");
  }
}

export async function applyShadowAlternativeAction(
  projectId: string,
  altId: string,
) {
  const {
    getDesignCanvas,
    saveDesignCanvasApi,
  } = await import("../lib/api");
  const { applyShadowAlternative } = await import("@workstream/domain");
  try {
    const canvas = await getDesignCanvas(projectId);
    if (!canvas) {
      throw new Error("No design canvas to apply alternative");
    }
    const { canvas: next, note } = applyShadowAlternative(canvas, altId);
    const saved = await saveDesignCanvasApi(
      projectId,
      next.placements,
      next.strokes ?? [],
      next.irrigation_zones ?? [],
      next.annotations,
      next.image_layers,
      next.site_frame,
      next.features,
      next.construction_trenches,
    );
    revalidatePath(`/projects/${projectId}`);
    return { canvas: saved.canvas, note };
  } catch (err) {
    throw wrapApiError(err, "Apply alternative failed");
  }
}

export async function acceptOrchestrationOverlayAction(
  projectId: string,
  proposalId: string,
) {
  const { acceptOrchestrationOverlayApi } = await import("../lib/api");
  try {
    const result = await acceptOrchestrationOverlayApi(projectId, proposalId);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "Accept overlay failed");
  }
}

export async function dismissOrchestrationOverlayAction(
  projectId: string,
  proposalId: string,
) {
  const { dismissOrchestrationOverlayApi } = await import("../lib/api");
  try {
    const world = await dismissOrchestrationOverlayApi(projectId, proposalId);
    revalidatePath(`/projects/${projectId}`);
    return world;
  } catch (err) {
    throw wrapApiError(err, "Dismiss overlay failed");
  }
}

export async function getCadDocumentAction(projectId: string) {
  const { getCadDocumentApi } = await import("../lib/api");
  try {
    return await getCadDocumentApi(projectId);
  } catch (err) {
    throw wrapApiError(err, "Failed to load AI CAD");
  }
}

export async function ensureCadAction(projectId: string) {
  const { ensureCadApi } = await import("../lib/api");
  try {
    const result = await ensureCadApi(projectId);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "Could not open CAD sheet");
  }
}

export async function applyCadOpsAction(
  projectId: string,
  ops: import("@workstream/contracts").CadOp[],
) {
  const { applyCadOpsApi } = await import("../lib/api");
  try {
    const result = await applyCadOpsApi(projectId, ops);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "Could not save CAD line");
  }
}

export async function generateCadAction(projectId: string) {
  const { generateCadApi } = await import("../lib/api");
  try {
    const result = await generateCadApi(projectId);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "AI CAD generate failed");
  }
}

export async function editCadAction(projectId: string, instruction: string) {
  const { editCadApi } = await import("../lib/api");
  try {
    const result = await editCadApi(projectId, instruction);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "AI CAD edit failed");
  }
}

export async function acceptCadAction(
  projectId: string,
  entityIds?: string[],
) {
  const { acceptCadApi } = await import("../lib/api");
  try {
    const result = await acceptCadApi(projectId, entityIds);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "AI CAD accept failed");
  }
}

export async function downloadCadDxfAction(projectId: string): Promise<string> {
  const { downloadCadDxfApi, ensureCadApi } = await import("../lib/api");
  try {
    // Ensure calibrated metre sheet exists (stamps site frame when present).
    await ensureCadApi(projectId);
    const blob = await downloadCadDxfApi(projectId);
    return await blob.text();
  } catch (err) {
    throw wrapApiError(err, "DXF download failed");
  }
}

export async function downloadCadGltfAction(projectId: string): Promise<string> {
  const { downloadCadGltfApi, ensureCadApi } = await import("../lib/api");
  try {
    await ensureCadApi(projectId);
    const blob = await downloadCadGltfApi(projectId);
    return await blob.text();
  } catch (err) {
    throw wrapApiError(err, "glTF download failed");
  }
}

export async function downloadCadSyncAction(projectId: string): Promise<string> {
  const { downloadCadSyncApi, ensureCadApi } = await import("../lib/api");
  try {
    await ensureCadApi(projectId);
    const blob = await downloadCadSyncApi(projectId);
    return await blob.text();
  } catch (err) {
    throw wrapApiError(err, "CAD sync manifest download failed");
  }
}

export async function cadQuantitySurveyAction(projectId: string) {
  const { cadQuantitySurveyApi } = await import("../lib/api");
  try {
    const result = await cadQuantitySurveyApi(projectId);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "Quantity survey failed");
  }
}

export async function cadBuildAction(
  projectId: string,
  scenario: "lean" | "standard" | "buffer" = "standard",
) {
  const { cadBuildApi } = await import("../lib/api");
  try {
    const result = await cadBuildApi(projectId, scenario);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "Itemised build failed");
  }
}

export async function cadQuoteAction(
  projectId: string,
  scenario: "lean" | "standard" | "buffer" = "standard",
) {
  const { cadQuoteApi } = await import("../lib/api");
  try {
    const result = await cadQuoteApi(projectId, scenario);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "Quote generation failed");
  }
}

export async function autoTraceBoundaryAction(projectId: string) {
  const { autoTraceBoundaryApi } = await import("../lib/api");
  try {
    const result = await autoTraceBoundaryApi(projectId, true);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "Boundary auto-trace failed");
  }
}

export async function hydrateKeylessAction(
  projectId: string,
  kinds?: Array<
    | "planning"
    | "bushfire"
    | "contour"
    | "flood"
    | "heritage"
    | "easement"
    | "urban_tree"
    | "water_corp"
    | "road_casement"
    | "acid_sulfate"
    | "wetland"
  >,
) {
  const { hydrateKeylessApi } = await import("../lib/api");
  try {
    const result = await hydrateKeylessApi(projectId, kinds);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "KEYLESS hydrate failed");
  }
}

/** Site boundary for co-registering KEYLESS canvas-metre rings (server-only). */
export async function getSiteBoundaryAction(projectId: string) {
  const { getSiteBoundaryApi } = await import("../lib/api");
  try {
    return await getSiteBoundaryApi(projectId);
  } catch (err) {
    throw wrapApiError(err, "Boundary load failed");
  }
}

/** Council drainage GeoJSON → canvas-metre lines (server-only). */
export async function ingestStormwaterGeoJsonAction(
  projectId: string,
  geojson: unknown,
) {
  const { ingestStormwaterGeoJsonApi } = await import("../lib/api");
  try {
    return await ingestStormwaterGeoJsonApi(projectId, geojson);
  } catch (err) {
    throw wrapApiError(err, "Stormwater GeoJSON ingest failed");
  }
}

export async function listProjectFilesAction(projectId: string) {
  const { listProjectFiles } = await import("../lib/api");
  try {
    return await listProjectFiles(projectId);
  } catch (err) {
    throw wrapApiError(err, "Project files list failed");
  }
}

export async function saveBoundaryAction(
  projectId: string,
  boundary: import("../lib/canvas-types").SiteBoundaryLite,
) {
  const { putSiteBoundaryApi } = await import("../lib/api");
  try {
    const result = await putSiteBoundaryApi(projectId, boundary);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "Boundary save failed");
  }
}

export async function lockBoundaryAction(projectId: string) {
  const { lockBoundaryApi } = await import("../lib/api");
  try {
    const result = await lockBoundaryApi(projectId);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "Boundary lock failed");
  }
}

export async function unlockBoundaryAction(projectId: string) {
  const { unlockBoundaryApi } = await import("../lib/api");
  try {
    const result = await unlockBoundaryApi(projectId);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "Boundary unlock failed");
  }
}

export async function resetBoundaryAction(projectId: string) {
  const { resetBoundaryApi } = await import("../lib/api");
  try {
    const result = await resetBoundaryApi(projectId);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "Boundary reset failed");
  }
}

export async function runSketchCostingAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) throw new Error("Missing project");
  try {
    await runSketchCosting(projectId);
  } catch (err) {
    throw wrapApiError(err, "Sketch estimate failed");
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/costing`);
  revalidatePath(`/projects/${projectId}/design`);
  revalidatePath(`/projects/${projectId}/design/develop`);
}

/**
 * Sketch-costing payload for the WebGL fit-sheet — the backend instant
 * estimate (POST /costing/sketch) beside the client-side parametric total,
 * so drift between the two pricing paths is visible on the card.
 */
export async function fetchSketchEstimateAction(projectId: string) {
  if (!projectId.trim()) return null;
  const { runSketchCosting } = await import("../lib/api");
  try {
    return await runSketchCosting(projectId);
  } catch {
    return null;
  }
}

export async function runDevelopFromSketchAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) throw new Error("Missing project");
  try {
    await runDevelopFromSketchPipeline(projectId);
  } catch (err) {
    throw wrapApiError(err, "Develop pipeline failed");
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/processing`);
}

export async function restartPipelineAction(projectId: string) {
  if (!projectId) throw new Error("Missing project");
  try {
    await runFullPipeline(projectId);
  } catch (err) {
    throw wrapApiError(err, "Could not restart processing");
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/processing`);
}

export async function runDesignAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) throw new Error("Missing project");
  try {
    await runDesign(projectId);
  } catch (err) {
    throw wrapApiError(err, "Design failed");
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/design`);
  revalidatePath(`/projects/${projectId}/design/develop`);
}

export async function runCostingAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) throw new Error("Missing project");
  try {
    await runCosting(projectId);
  } catch (err) {
    throw wrapApiError(err, "Costing failed");
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/costing`);
}

export async function runAuditAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) throw new Error("Missing project");
  try {
    await runAudit(projectId);
  } catch (err) {
    throw wrapApiError(err, "Audit failed");
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/audit`);
}

export async function runOutputAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const kind = String(formData.get("kind") ?? "") as OutputKind;
  if (!projectId || !kind) throw new Error("Missing project or output type");
  try {
    await runOutput(projectId, kind);
  } catch (err) {
    throw wrapApiError(err, "Output generation failed");
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/outputs`);
}

export async function createOverrideAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const findingIndexRaw = String(formData.get("finding_index") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const finding_index = Number(findingIndexRaw);
  if (
    !projectId ||
    !Number.isInteger(finding_index) ||
    finding_index < 0 ||
    reason.length < 8
  ) {
    throw new Error("Override needs a finding and a reason (8+ characters)");
  }
  try {
    await createOverrideApi(projectId, { finding_index, reason });
  } catch (err) {
    throw wrapApiError(err, "Could not save override");
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/audit`);
}

/* -- Tasks ------------------------------------------------------------ */

export async function createTaskAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const assignee = String(formData.get("assignee_name") ?? "").trim();
  const priority = String(formData.get("priority") ?? "medium") as TaskPriority;
  const sourceRaw = String(formData.get("source") ?? "manual");
  const source =
    sourceRaw === "design" || sourceRaw === "dictation" ? sourceRaw : "manual";
  const technical = String(formData.get("technical_specifications") ?? "").trim();
  if (!projectId || !title) {
    throw new Error("Task needs a title");
  }
  try {
    await createTaskApi(projectId, {
      title,
      assignee_name: assignee || null,
      priority,
      source,
      technical_specifications: technical || null,
    });
  } catch (err) {
    throw wrapApiError(err, "Could not create task");
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tasks`);
}

export async function updateTaskStatusAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "") as TaskStatus;
  if (!projectId || !taskId || !status) {
    throw new Error("Missing task update fields");
  }
  try {
    await updateTaskStatusApi(projectId, taskId, status);
  } catch (err) {
    throw wrapApiError(err, "Could not update task");
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tasks`);
}

/**
 * Sync design-sourced permit / compliance todos from the live canvas.
 * Creates missing drafts; cancels pending design tasks whose trigger no longer applies.
 */
export async function syncDesignTodosAction(
  projectId: string,
  proposed: Array<{
    title: string;
    priority?: TaskPriority;
    technical_specifications?: string | null;
    trigger_id: string;
  }>,
): Promise<{ tasks: Awaited<ReturnType<typeof listTasks>>; created: number }> {
  if (!projectId) return { tasks: [], created: 0 };
  const { diffDesignTodos, encodeDesignTodoSpec } = await import(
    "@workstream/domain"
  );
  const existing = await listTasks(projectId);
  const drafts = proposed.map((p) => ({
    trigger_id: p.trigger_id,
    title: p.title,
    priority: p.priority ?? ("medium" as TaskPriority),
    source: "design" as const,
    technical_specifications:
      p.technical_specifications ??
      encodeDesignTodoSpec(p.trigger_id, p.title),
  }));
  const { toCreate, toCancelIds } = diffDesignTodos(existing, drafts);
  let created = 0;
  for (const draft of toCreate) {
    await createTaskApi(projectId, {
      title: draft.title,
      priority: draft.priority,
      source: "design",
      technical_specifications: draft.technical_specifications ?? null,
    });
    created += 1;
  }
  for (const id of toCancelIds) {
    await updateTaskStatusApi(projectId, id, "cancelled");
  }
  const tasks = await listTasks(projectId);
  if (created > 0 || toCancelIds.length > 0) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/tasks`);
  }
  return { tasks, created };
}

export async function listProjectTasksAction(projectId: string) {
  if (!projectId) return [];
  return listTasks(projectId);
}

export type PortalLinkState = {
  url?: string;
  error?: string;
};

export async function createQuotePortalLinkAction(
  _prev: PortalLinkState | null,
  formData: FormData,
): Promise<PortalLinkState> {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { error: "Missing project." };
  try {
    const { createPortalLinkApi } = await import("../lib/api");
    const res = await createPortalLinkApi(projectId);
    return { url: res.portal_url };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create client link.";
    return { error: message };
  }
}

export async function copyPortalLinkAction(projectId: string): Promise<string> {
  const { createPortalLinkApi } = await import("../lib/api");
  const { portal_url } = await createPortalLinkApi(projectId);
  return portal_url;
}

export async function listShareRevisionsAction(projectId: string) {
  const { listShareRevisionsApi } = await import("../lib/api");
  try {
    return await listShareRevisionsApi(projectId);
  } catch (err) {
    throw wrapApiError(err, "Could not load share revisions");
  }
}

export async function createShareRevisionAction(
  projectId: string,
  quoteLines: Array<{
    id: string;
    label: string;
    unit: string;
    qty: number;
    total: number;
  }>,
  totalInclGst: number,
) {
  const { createShareRevisionApi } = await import("../lib/api");
  try {
    const result = await createShareRevisionApi(projectId, {
      quoteLines,
      totalInclGst,
    });
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "Could not create share link");
  }
}

export async function saveProjectClientAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw new Error("Missing project");
  const { updateProjectClientApi } = await import("../lib/api");
  const client_name = String(formData.get("client_name") ?? "").trim() || null;
  const rawEmail = String(formData.get("client_email") ?? "").trim();
  if (rawEmail && !isPlausibleEmail(rawEmail)) {
    throw new Error("Enter a valid client email address");
  }
  const client_email = rawEmail || null;
  const rawStage = String(formData.get("crm_stage") ?? "").trim();
  const crm_stage =
    rawStage === "enquiry" ||
      rawStage === "quote_sent" ||
      rawStage === "won" ||
      rawStage === "lost"
      ? rawStage
      : null;
  try {
    await updateProjectClientApi(projectId, {
      client_name,
      client_email,
      crm_stage,
    });
  } catch (err) {
    throw wrapApiError(err, "Could not save client details");
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/outputs`);
}

export async function syncQuotePackAction(formData: FormData): Promise<{
  ok: boolean;
  crm: boolean;
  email: boolean;
}> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw new Error("Missing project");
  const { syncProjectIntegrationsApi } = await import("../lib/api");
  const to_email = String(formData.get("to_email") ?? "").trim() || undefined;
  if (to_email && !isPlausibleEmail(to_email)) {
    throw new Error("Enter a valid email address");
  }
  const client_name =
    String(formData.get("client_name") ?? "").trim() || undefined;
  const include_portal = formData.get("include_portal") === "1";
  try {
    const result = await syncProjectIntegrationsApi(projectId, {
      to_email,
      client_name,
      include_portal,
    });
    revalidatePath(`/projects/${projectId}/outputs`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "Could not sync quote pack");
  }
}

/** QuoteDoc — client hooks must use these actions (lib/api is server-only). */
export async function getQuoteDocAction(projectId: string) {
  try {
    return await getQuoteDocApi(projectId);
  } catch (err) {
    throw wrapApiError(err, "Could not load quote");
  }
}

export async function upsertQuoteDocAction(
  projectId: string,
  body: UpsertQuoteDocInput,
) {
  try {
    const saved = await upsertQuoteDocApi(projectId, body);
    revalidatePath(`/projects/${projectId}`);
    return saved;
  } catch (err) {
    throw wrapApiError(err, "Could not save quote");
  }
}

/** Vicmap auto-trace payload for the WebGL site-truth import. */
export async function autoTraceBoundaryDataAction(projectId: string) {
  const { autoTraceBoundaryApi } = await import("../lib/api");
  try {
    return await autoTraceBoundaryApi(projectId, true);
  } catch (err) {
    throw wrapApiError(err, "Auto-trace failed");
  }
}

/** Keyless overlay hydration payload for the site-truth import. */
export async function hydrateKeylessDataAction(projectId: string) {
  const { hydrateKeylessApi } = await import("../lib/api");
  try {
    return await hydrateKeylessApi(projectId);
  } catch (err) {
    throw wrapApiError(err, "Overlay hydration failed");
  }
}
