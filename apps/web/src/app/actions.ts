"use server";

import { revalidatePath } from "next/cache";
import {
  createCrewApi,
  createOverrideApi,
  createProjectApi,
  geocodePreviewApi,
  geocodeSearchApi,
  createTaskApi,
  deleteCrewApi,
  deleteIntegrationApi,
  deleteProjectApi,
  restoreProjectApi,
  getAudit,
  getDesign,
  getProject,
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
  annotations: DesignCanvas["annotations"] = [],
) {
  try {
    await saveDesignCanvasApi(
      projectId,
      placements,
      strokes,
      irrigationZones,
      annotations,
    );
  } catch (err) {
    throw wrapApiError(err, "Failed to save site plan");
  }
  revalidatePath(`/projects/${projectId}/design`);
  revalidatePath(`/projects/${projectId}/design/develop`);
  revalidatePath(`/projects/${projectId}/design/studio`);
}

export async function scanDesignGhostsAction(projectId: string) {
  const { scanDesignGhostsApi } = await import("../lib/api");
  try {
    return await scanDesignGhostsApi(projectId);
  } catch (err) {
    throw wrapApiError(err, "AI site scan failed");
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

export async function generateCadAction(projectId: string) {
  const { generateCadApi } = await import("../lib/api");
  try {
    const result = await generateCadApi(projectId);
    revalidatePath(`/projects/${projectId}/design/cad`);
    return result;
  } catch (err) {
    throw wrapApiError(err, "AI CAD generate failed");
  }
}

export async function editCadAction(projectId: string, instruction: string) {
  const { editCadApi } = await import("../lib/api");
  try {
    const result = await editCadApi(projectId, instruction);
    revalidatePath(`/projects/${projectId}/design/cad`);
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
    revalidatePath(`/projects/${projectId}/design/cad`);
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
  if (!projectId || !title) return;
  await createTaskApi(projectId, {
    title,
    assignee_name: assignee || null,
    priority,
  });
  revalidatePath(`/projects/${projectId}/tasks`);
}

export async function updateTaskStatusAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "") as TaskStatus;
  if (!projectId || !taskId || !status) return;
  await updateTaskStatusApi(projectId, taskId, status);
  revalidatePath(`/projects/${projectId}/tasks`);
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
}

export async function startStudioCheckoutAction(): Promise<{
  checkout_url: string;
  mode: "live" | "dev_fallback";
}> {
  const { startStudioCheckoutApi } = await import("../lib/api");
  return startStudioCheckoutApi();
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
