"use server";

import { revalidatePath } from "next/cache";
import {
  createCrewApi,
  createOverrideApi,
  createProjectApi,
  geocodePreviewApi,
  geocodeSearchApi,
  createTaskApi,
  listTasks,
  deleteCrewApi,
  deleteIntegrationApi,
  deleteProjectApi,
  restoreProjectApi,
  getAudit,
  getDesign,
  getProject,
  listProjects,
  getSurvey,
  saveDesignCanvasApi,
  createCatalogSymbolApi,
  deleteCatalogSymbolApi,
  type CatalogPlacement,
  type CreateCatalogSymbolInput,
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
  setIntegrationApi,
  updateRateCardItemApi,
  updateTaskStatusApi,
  type CrewRole,
  type OutputKind,
  type TaskPriority,
  type TaskStatus,
} from "../lib/api";

function wrapApiError(err: unknown, fallback: string): Error {
  return new Error(err instanceof Error ? err.message : fallback);
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

/** Create project, run survey, return id for client redirect. */
export async function createProjectWithSurveyAction(formData: FormData) {
  const address = String(formData.get("address") ?? "").trim();
  if (address.length < 5) {
    throw new Error("Enter a valid street address");
  }
  const { lat, lng } = parseProjectCoords(formData);
  try {
    const project = await createProjectApi({ address, lat, lng });
    await runSurvey(project.id);
    revalidatePath("/");
    revalidatePath(`/projects/${project.id}`);
    revalidatePath(`/projects/${project.id}/survey`);
    return { projectId: project.id };
  } catch (err) {
    throw wrapApiError(err, "Could not create project");
  }
}

export async function createProjectAction(formData: FormData) {
  const address = String(formData.get("address") ?? "").trim();
  if (address.length < 5) return;
  const { lat, lng } = parseProjectCoords(formData);
  await createProjectApi({ address, lat, lng });
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
  if (!id) return;
  await deleteProjectApi(id);
  revalidatePath("/");
}

export async function restoreProjectAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await restoreProjectApi(id);
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
  const { downloadCadDxfApi } = await import("../lib/api");
  try {
    const blob = await downloadCadDxfApi(projectId);
    return await blob.text();
  } catch (err) {
    throw wrapApiError(err, "DXF download failed");
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
    return;
  }
  await createOverrideApi(projectId, { finding_index, reason });
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
  if (!projectId || !title) return;
  await createTaskApi(projectId, {
    title,
    assignee_name: assignee || null,
    priority,
    source,
    technical_specifications: technical || null,
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tasks`);
}

export async function updateTaskStatusAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "") as TaskStatus;
  if (!projectId || !taskId || !status) return;
  await updateTaskStatusApi(projectId, taskId, status);
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

/* -- Crew ------------------------------------------------------------- */

export async function createCrewAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "tradesperson") as CrewRole;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const rateRaw = String(formData.get("hourly_rate") ?? "0");
  const hourly_rate = Number.isFinite(Number(rateRaw)) ? Number(rateRaw) : 0;
  if (!name) return;
  await createCrewApi({ name, role, phone, email, hourly_rate });
  revalidatePath("/settings/crew");
}

export async function deleteCrewAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteCrewApi(id);
  revalidatePath("/settings/crew");
}

/* -- Design assets (catalog) ------------------------------------------ */

export async function createCatalogSymbolAction(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const category = String(
    formData.get("category") ?? "planting",
  ) as CreateCatalogSymbolInput["category"];
  const path_d = String(formData.get("path_d") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const rate_card_sku = String(formData.get("rate_card_sku") ?? "").trim();
  const preview_bg = String(formData.get("preview_bg") ?? "").trim();
  const accent = String(formData.get("accent") ?? "").trim();
  if (!label || !path_d) throw new Error("Label and SVG path are required");
  const input: CreateCatalogSymbolInput = {
    label,
    category,
    path_d,
  };
  if (description) input.description = description;
  if (rate_card_sku) input.rate_card_sku = rate_card_sku;
  if (preview_bg) input.preview_bg = preview_bg;
  if (accent) input.accent = accent;
  try {
    await createCatalogSymbolApi(input);
  } catch (err) {
    throw wrapApiError(err, "Failed to upload design asset");
  }
  revalidatePath("/settings/design-assets");
}

export async function deleteCatalogSymbolAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id.startsWith("custom-")) return;
  try {
    await deleteCatalogSymbolApi(id);
  } catch (err) {
    throw wrapApiError(err, "Failed to delete design asset");
  }
  revalidatePath("/settings/design-assets");
}

/* -- Rate card -------------------------------------------------------- */

export async function updateRateAction(formData: FormData) {
  const sku = String(formData.get("sku") ?? "");
  const rateRaw = String(formData.get("rate") ?? "");
  const rate = Number(rateRaw);
  if (!sku || !Number.isFinite(rate) || rate < 0) return;
  await updateRateCardItemApi(sku, { rate });
  revalidatePath("/settings/rate-card");
}

/* -- Integrations ----------------------------------------------------- */

export async function setIntegrationAction(formData: FormData) {
  const key = String(formData.get("key") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  if (!key || !value) throw new Error("Key and value are required");
  try {
    await setIntegrationApi(key, value);
  } catch (err) {
    throw wrapApiError(err, "Could not save integration");
  }
  revalidatePath("/settings");
}

export async function clearIntegrationAction(formData: FormData) {
  const key = String(formData.get("key") ?? "").trim();
  if (!key) throw new Error("Missing integration key");
  try {
    await deleteIntegrationApi(key);
  } catch (err) {
    throw wrapApiError(err, "Could not clear integration");
  }
  revalidatePath("/settings");
}

export async function testIntegrationAction(
  channel: string,
  toEmail?: string,
): Promise<{ ok: boolean; detail: string }> {
  const { testIntegrationApi } = await import("../lib/api");
  const result = await testIntegrationApi(channel, toEmail);
  revalidatePath("/settings");
  return result;
}

export async function upgradePlanAction(plan: "lite" | "studio"): Promise<void> {
  const { upgradeWorkspacePlanApi } = await import("../lib/api");
  await upgradeWorkspacePlanApi(plan);
  revalidatePath("/settings");
  revalidatePath("/settings/license");
}

export async function startStudioCheckoutAction(): Promise<{
  checkout_url: string;
  mode: "live" | "dev_fallback";
}> {
  const { startStudioCheckoutApi } = await import("../lib/api");
  const result = await startStudioCheckoutApi();
  revalidatePath("/settings/license");
  return result;
}

export async function startSeatCheckoutAction(extraSeats = 1): Promise<{
  checkout_url: string;
  mode: "live" | "dev_fallback";
  seat_limit: number;
}> {
  const { startSeatCheckoutApi } = await import("../lib/api");
  const result = await startSeatCheckoutApi(extraSeats);
  revalidatePath("/settings/license");
  return result;
}

export async function inviteWorkspaceMemberAction(userId: string): Promise<void> {
  const { inviteWorkspaceMemberApi } = await import("../lib/api");
  await inviteWorkspaceMemberApi(userId);
  revalidatePath("/settings/license");
}

export async function removeWorkspaceMemberAction(userId: string): Promise<void> {
  const { removeWorkspaceMemberApi } = await import("../lib/api");
  await removeWorkspaceMemberApi(userId);
  revalidatePath("/settings/license");
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
  const client_email = rawEmail || null;
  const rawStage = String(formData.get("crm_stage") ?? "").trim();
  const crm_stage =
    rawStage === "enquiry" ||
    rawStage === "quote_sent" ||
    rawStage === "won" ||
    rawStage === "lost"
      ? rawStage
      : null;
  await updateProjectClientApi(projectId, {
    client_name,
    client_email,
    crm_stage,
  });
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
  const client_name =
    String(formData.get("client_name") ?? "").trim() || undefined;
  const include_portal = formData.get("include_portal") === "1";
  const result = await syncProjectIntegrationsApi(projectId, {
    to_email,
    client_name,
    include_portal,
  });
  revalidatePath(`/projects/${projectId}/outputs`);
  return result;
}
