import "server-only";

import type {
  CadDocument,
  CatalogPlacement,
  CatalogSymbol,
  CreateCatalogSymbolInput,
  DesignCanvas,
  DesignAssistResponse,
  DesignGhostsResponse,
  ProjectOrchestrationWorld,
  SketchToCadRequest,
  SketchToCadResponse,
} from "@workstream/contracts";
import { clerkEnabled } from "./auth";
import { operatorApiUrl } from "./public-env";

const API_URL = operatorApiUrl();

async function apiHeaders(json = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (!clerkEnabled) return headers;
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const { getToken } = await auth();
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* Clerk not configured — API accepts dev-user when AUTH_REQUIRED=false */
  }
  return headers;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    headers: await apiHeaders(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} on GET ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: await apiHeaders(body != null),
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} on POST ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: await apiHeaders(true),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} on PATCH ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "PUT",
      headers: await apiHeaders(true),
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Couldn't reach the server on PUT ${path}: ${msg}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} on PUT ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function apiDelete<T = void>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    cache: "no-store",
    headers: await apiHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`API ${res.status} on DELETE ${path}`);
  }
  if (res.status === 204 || res.status === 404) return undefined as T;
  const text = await res.text().catch(() => "");
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/* -- Projects ---------------------------------------------------------- */

export type ProjectStatus =
  | "draft"
  | "recording"
  | "processing"
  | "survey_review"
  | "design_review"
  | "cost_review"
  | "audit"
  | "outputs"
  | "complete";

export type CrmStage = "enquiry" | "quote_sent" | "won" | "lost";

export type Project = {
  id: string;
  owner_id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  created_at: string;
  status: ProjectStatus;
  client_name?: string | null;
  client_email?: string | null;
  crm_stage?: CrmStage | null;
  crm_synced_at?: string | null;
};

export async function updateProjectClientApi(
  projectId: string,
  patch: {
    client_name?: string | null;
    client_email?: string | null;
    crm_stage?: CrmStage | null;
  },
): Promise<Project> {
  const body = await apiPatch<{ project: Project }>(
    `/projects/${projectId}/client`,
    patch,
  );
  return body.project;
}

export async function listProjects(): Promise<Project[]> {
  const body = await apiGet<{ projects: Project[] }>("/projects/");
  return body.projects;
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    const body = await apiGet<{ project: Project }>(`/projects/${id}`);
    return body.project;
  } catch (err) {
    if (err instanceof Error && /API 404/.test(err.message)) return null;
    throw err;
  }
}

export type GeocodeSuggestion = {
  id: string;
  place_name: string;
  text: string;
  lat: number;
  lng: number;
};

export async function geocodePreviewApi(
  lat: number,
  lng: number,
): Promise<{ aerial_uri: string; lat: number; lng: number }> {
  return apiGet<{ aerial_uri: string; lat: number; lng: number }>(
    `/geocode/preview?lat=${lat}&lng=${lng}`,
  );
}

export async function geocodeSearchApi(
  query: string,
): Promise<GeocodeSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const body = await apiGet<{ suggestions: GeocodeSuggestion[] }>(
    `/geocode/search?q=${encodeURIComponent(q)}`,
  );
  return body.suggestions;
}

export async function createProjectApi(input: {
  address: string;
  lat?: number;
  lng?: number;
}): Promise<Project> {
  const body = await apiPost<{ project: Project }>("/projects/", input);
  return body.project;
}

export async function deleteProjectApi(id: string): Promise<void> {
  await apiDelete(`/projects/${id}`);
}

export async function restoreProjectApi(id: string): Promise<Project> {
  const body = await apiPost<{ project: Project }>(`/projects/${id}/restore`, {});
  return body.project;
}

/* -- Survey ------------------------------------------------------------ */

export type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: [number, number][][];
};

export type Survey = {
  id: string;
  project_id: string;
  aerial_uri: string;
  title_polygon: GeoJsonPolygon;
  house_polygon: GeoJsonPolygon;
  garden_polygon: GeoJsonPolygon;
  lot_area_m2: number;
  house_area_m2: number;
  garden_area_m2: number;
  measurements: Array<{
    edge_id: string;
    length_m: number;
    bearing_deg: number;
    label?: string;
  }>;
};

export async function getSurvey(projectId: string): Promise<Survey | null> {
  try {
    const body = await apiGet<{ survey: Survey }>(`/projects/${projectId}/survey`);
    return body.survey;
  } catch (err) {
    if (err instanceof Error && /API 404/.test(err.message)) return null;
    throw err;
  }
}

export async function runSurvey(projectId: string): Promise<Survey> {
  const body = await apiPost<{ survey: Survey }>(`/projects/${projectId}/survey`);
  return body.survey;
}

/* -- Design ------------------------------------------------------------ */

export type Zone = {
  id: string;
  name: string;
  treatment: string;
  plantings: Array<{
    species: string;
    common_name: string;
    count: number;
    form: string;
    sku?: string;
  }>;
  hardscape: Array<{ item: string; qty: number; unit: string; sku?: string }>;
  lighting: Array<{ fixture: string; count: number; sku?: string }>;
  irrigation: Array<{ item: string; qty: number; unit: string; sku?: string }>;
};

export type Design = {
  id: string;
  project_id: string;
  mode: "auto" | "gapfill" | "validate";
  proposal: {
    zones: Zone[];
    estimated_complexity: "simple" | "standard" | "complex";
  };
  gaps: Array<{
    zone: string;
    description: string;
    proposed_fill: string;
    rationale: string;
  }>;
  rationale: string;
  version: number;
};

export async function getDesign(projectId: string): Promise<Design | null> {
  try {
    const body = await apiGet<{ design: Design }>(`/projects/${projectId}/design`);
    return body.design;
  } catch (err) {
    if (err instanceof Error && /API 404/.test(err.message)) return null;
    throw err;
  }
}

export async function runDesign(projectId: string): Promise<Design> {
  const body = await apiPost<{ design: Design }>(`/projects/${projectId}/design`);
  return body.design;
}

/* -- Design studio (catalog + canvas) ---------------------------------- */

export type {
  CatalogAsset,
  CatalogCategory,
  CatalogGlyphLayer,
  CatalogPlacement,
  CatalogSymbol,
  CreateCatalogSymbolInput,
  DesignCanvas,
} from "@workstream/contracts";

export async function listCatalogSymbols(): Promise<CatalogSymbol[]> {
  const body = await apiGet<{ symbols: CatalogSymbol[] }>("/catalog/symbols");
  return body.symbols;
}

export async function createCatalogSymbolApi(
  input: CreateCatalogSymbolInput,
): Promise<CatalogSymbol> {
  const body = await apiPost<{ symbol: CatalogSymbol }>(
    "/catalog/symbols",
    input,
  );
  return body.symbol;
}

export async function deleteCatalogSymbolApi(id: string): Promise<void> {
  await apiDelete(`/catalog/symbols/${id}`);
}

export async function getDesignCanvas(
  projectId: string,
): Promise<DesignCanvas | null> {
  const body = await apiGet<{
    canvas: DesignCanvas & { id: string | null };
  }>(`/projects/${projectId}/design-canvas`);
  if (!body.canvas?.id) return null;
  return body.canvas as DesignCanvas;
}

export type SketchQuoteSummary = {
  total: number;
  budget_low: number;
  budget_mid: number;
  budget_high: number;
  garden_area_m2: number;
  line_count: number;
};

export async function saveDesignCanvasApi(
  projectId: string,
  placements: CatalogPlacement[],
  strokes: DesignCanvas["strokes"] = [],
  irrigationZones: DesignCanvas["irrigation_zones"] = [],
  annotations?: DesignCanvas["annotations"],
  siteFrame?: DesignCanvas["site_frame"],
): Promise<{ canvas: DesignCanvas; quote: SketchQuoteSummary | null }> {
  const body = await apiPut<{
    canvas: DesignCanvas;
    quote: SketchQuoteSummary | null;
  }>(`/projects/${projectId}/design-canvas`, {
    placements,
    strokes,
    irrigation_zones: irrigationZones,
    ...(annotations != null ? { annotations } : {}),
    ...(siteFrame != null ? { site_frame: siteFrame } : {}),
  });
  return { canvas: body.canvas, quote: body.quote ?? null };
}

export async function scanDesignGhostsApi(
  projectId: string,
): Promise<DesignGhostsResponse> {
  return apiPost<DesignGhostsResponse>(`/projects/${projectId}/design/ghosts`, {});
}

export async function designAssistApi(
  projectId: string,
  message: string,
): Promise<DesignAssistResponse> {
  return apiPost<DesignAssistResponse>(`/projects/${projectId}/design/assist`, {
    message,
  });
}

export async function formalizeSketchToCadApi(
  projectId: string,
  body: SketchToCadRequest,
): Promise<SketchToCadResponse> {
  return apiPost<SketchToCadResponse>(
    `/projects/${projectId}/design/sketch-cad`,
    body,
  );
}

export async function getOrchestrationApi(
  projectId: string,
): Promise<ProjectOrchestrationWorld> {
  return apiGet<ProjectOrchestrationWorld>(
    `/projects/${projectId}/orchestration`,
  );
}

export async function acceptOrchestrationOverlayApi(
  projectId: string,
  proposalId: string,
): Promise<{
  world: ProjectOrchestrationWorld;
  placed: CatalogPlacement | null;
}> {
  return apiPost(`/projects/${projectId}/orchestration/accept-overlay`, {
    proposal_id: proposalId,
  });
}

export async function dismissOrchestrationOverlayApi(
  projectId: string,
  proposalId: string,
): Promise<ProjectOrchestrationWorld> {
  return apiPost(`/projects/${projectId}/orchestration/dismiss-overlay`, {
    proposal_id: proposalId,
  });
}

export type CadApiResult = {
  document: CadDocument | null;
  svg: string | null;
  ghost_count: number;
  rationale?: string;
  applied?: number;
};

export async function getCadDocumentApi(
  projectId: string,
): Promise<CadApiResult> {
  return apiGet<CadApiResult>(`/projects/${projectId}/cad`);
}

export async function ensureCadApi(
  projectId: string,
): Promise<CadApiResult> {
  return apiPost<CadApiResult>(`/projects/${projectId}/cad/ensure`, {});
}

export async function applyCadOpsApi(
  projectId: string,
  ops: import("@workstream/contracts").CadOp[],
): Promise<CadApiResult> {
  return apiPost<CadApiResult>(`/projects/${projectId}/cad/ops`, { ops });
}

export async function generateCadApi(
  projectId: string,
): Promise<CadApiResult> {
  return apiPost<CadApiResult>(`/projects/${projectId}/cad/generate`, {});
}

export async function editCadApi(
  projectId: string,
  instruction: string,
): Promise<CadApiResult> {
  return apiPost<CadApiResult>(`/projects/${projectId}/cad/edit`, {
    instruction,
  });
}

export async function acceptCadApi(
  projectId: string,
  entityIds?: string[],
): Promise<CadApiResult> {
  return apiPost<CadApiResult>(`/projects/${projectId}/cad/accept`, {
    entity_ids: entityIds,
  });
}

export async function downloadCadDxfApi(projectId: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/projects/${projectId}/cad.dxf`, {
    cache: "no-store",
    headers: await apiHeaders(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} on GET cad.dxf: ${text}`);
  }
  return res.blob();
}

export type CadQuantitySurveyApi = {
  project_id: string;
  committed_only: boolean;
  rows: Array<{
    id: string;
    entity_id: string;
    layer: string;
    kind: string;
    label: string;
    qty: number;
    unit: "m2" | "lm" | "ea";
    anchor: { x: number; y: number };
    ghost: boolean;
  }>;
  totals: {
    hardscape_m2: number;
    planting_ea: number;
    irrigation_lm: number;
    structure_m2: number;
    other_m2: number;
    other_lm: number;
    other_ea: number;
  };
};

export type CadBuildApi = {
  survey: CadQuantitySurveyApi;
  line_items: Array<{
    sku: string;
    label: string;
    unit: string;
    qty: number;
    rate: number;
    total: number;
    notes?: string;
    is_provisional?: boolean;
  }>;
  scenario: "lean" | "standard" | "buffer";
  subtotal: number;
  contingency: number;
  gst: number;
  total: number;
};

export async function cadQuantitySurveyApi(
  projectId: string,
): Promise<{ survey: CadQuantitySurveyApi }> {
  return apiPost<{ survey: CadQuantitySurveyApi }>(
    `/projects/${projectId}/cad/quantity-survey`,
    {},
  );
}

export async function cadBuildApi(
  projectId: string,
  scenario: "lean" | "standard" | "buffer" = "standard",
): Promise<{ build: CadBuildApi }> {
  return apiPost<{ build: CadBuildApi }>(
    `/projects/${projectId}/cad/build`,
    { scenario },
  );
}

export async function cadQuoteApi(
  projectId: string,
  scenario: "lean" | "standard" | "buffer" = "standard",
): Promise<{
  build: CadBuildApi;
  survey: CadQuantitySurveyApi;
  markdown: string;
  html: string;
  output: {
    id: string;
    project_id: string;
    kind: string;
    uri: string;
    generated_at: string;
  } | null;
}> {
  return apiPost(`/projects/${projectId}/cad/quote`, { scenario });
}

/* -- HITL site boundary ------------------------------------------------ */

export type { SiteBoundaryLite, SiteEasementLite } from "./canvas-types";
import type { SiteBoundaryLite, SiteEasementLite } from "./canvas-types";

export async function getSiteBoundaryApi(
  projectId: string,
): Promise<{ boundary: SiteBoundaryLite | null }> {
  return apiGet<{ boundary: SiteBoundaryLite | null }>(
    `/projects/${projectId}/boundary`,
  );
}

export async function putSiteBoundaryApi(
  projectId: string,
  boundary: SiteBoundaryLite,
): Promise<{ boundary: SiteBoundaryLite }> {
  return apiPut<{ boundary: SiteBoundaryLite }>(
    `/projects/${projectId}/boundary`,
    boundary,
  );
}

export async function autoTraceBoundaryApi(
  projectId: string,
  preferGis = true,
): Promise<{ boundary: SiteBoundaryLite; easements?: SiteEasementLite[] }> {
  return apiPost<{ boundary: SiteBoundaryLite; easements?: SiteEasementLite[] }>(
    `/projects/${projectId}/boundary/auto-trace`,
    { prefer_gis: preferGis },
  );
}

export async function lockBoundaryApi(
  projectId: string,
): Promise<{ boundary: SiteBoundaryLite }> {
  return apiPost<{ boundary: SiteBoundaryLite }>(
    `/projects/${projectId}/boundary/lock`,
    {},
  );
}

export async function unlockBoundaryApi(
  projectId: string,
): Promise<{ boundary: SiteBoundaryLite }> {
  return apiPost<{ boundary: SiteBoundaryLite }>(
    `/projects/${projectId}/boundary/unlock`,
    {},
  );
}

export async function resetBoundaryApi(
  projectId: string,
): Promise<{ deleted: boolean }> {
  return apiDelete<{ deleted: boolean }>(`/projects/${projectId}/boundary`);
}

/* -- Costing ----------------------------------------------------------- */

export type CostScenario = "lean" | "standard" | "buffer";

export type LineItem = {
  sku: string;
  label: string;
  unit: string;
  qty: number;
  rate: number;
  total: number;
  notes?: string;
  is_provisional: boolean;
};

export type Costing = {
  id: string;
  design_id: string;
  scenario: CostScenario;
  line_items: LineItem[];
  subtotal: number;
  gst: number;
  total: number;
};

export async function listCostings(projectId: string): Promise<Costing[]> {
  const body = await apiGet<{ costings: Costing[] }>(
    `/projects/${projectId}/costing`,
  );
  return body.costings;
}

export type PlanningFlag = {
  id: string;
  category: string;
  severity: "likely" | "review" | "clear";
  title: string;
  detail: string;
  output_kind?: string;
};

export type EnvelopeBrief = {
  markdown: string;
  budget_low: number;
  budget_high: number;
  budget_mid: number;
  planning_flags: PlanningFlag[];
};

export async function getEnvelopeBrief(
  projectId: string,
): Promise<EnvelopeBrief | null> {
  try {
    const body = await apiGet<{ envelope: EnvelopeBrief }>(
      `/projects/${projectId}/envelope`,
    );
    return body.envelope;
  } catch (err) {
    if (err instanceof Error && /API 404/.test(err.message)) return null;
    throw err;
  }
}

export async function runSketchCosting(projectId: string): Promise<{
  costing: Costing;
  envelope: EnvelopeBrief;
}> {
  return apiPost<{ costing: Costing; envelope: EnvelopeBrief }>(
    `/projects/${projectId}/costing/sketch`,
  );
}

export async function runDevelopFromSketchPipeline(
  projectId: string,
): Promise<{ accepted: boolean }> {
  return apiPost<{ accepted: boolean }>(
    `/projects/${projectId}/pipeline/develop`,
  );
}

export async function runFullPipeline(projectId: string): Promise<{
  accepted: boolean;
  queued?: boolean;
  jobId?: string;
}> {
  return apiPost<{ accepted: boolean; queued?: boolean; jobId?: string }>(
    `/projects/${projectId}/pipeline`,
  );
}

export async function runCosting(projectId: string): Promise<Costing[]> {
  const body = await apiPost<{ costings: Costing[] }>(
    `/projects/${projectId}/costing`,
  );
  return body.costings;
}

/* -- Audit ------------------------------------------------------------- */

export type AuditFinding = {
  severity: "blocking" | "advisory";
  category: "fidelity" | "completeness" | "coherence" | "cost" | "safety" | "scope";
  location: string;
  statement: string;
  suggested_action: string;
};

export type Audit = {
  id: string;
  design_id: string;
  findings: AuditFinding[];
  blocking_count: number;
  advisory_count: number;
  passed: boolean;
};

export async function getAudit(projectId: string): Promise<Audit | null> {
  try {
    const body = await apiGet<{ audit: Audit }>(`/projects/${projectId}/audit`);
    return body.audit;
  } catch (err) {
    if (err instanceof Error && /API 404/.test(err.message)) return null;
    throw err;
  }
}

export async function runAudit(projectId: string): Promise<Audit> {
  const body = await apiPost<{ audit: Audit }>(`/projects/${projectId}/audit`);
  return body.audit;
}

export type Override = {
  id: string;
  project_id: string;
  audit_id: string;
  finding_index: number;
  category: AuditFinding["category"];
  location: string;
  reason: string;
  created_at: string;
};

export async function listOverrides(projectId: string): Promise<Override[]> {
  const body = await apiGet<{ overrides: Override[] }>(
    `/projects/${projectId}/overrides`,
  );
  return body.overrides;
}

export async function createOverrideApi(
  projectId: string,
  input: { finding_index: number; reason: string },
): Promise<{ override: Override; audit: Audit }> {
  return apiPost<{ override: Override; audit: Audit }>(
    `/projects/${projectId}/overrides`,
    input,
  );
}

/* -- Outputs ----------------------------------------------------------- */

export type OutputKind =
  | "task_list"
  | "schedule"
  | "quote"
  | "brochure"
  | "scope"
  | "daily_site_report"
  | "permit_stonnington_stormwater"
  | "permit_yarra_heritage";

export type Output = {
  id: string;
  project_id: string;
  kind: OutputKind;
  uri: string;
  generated_at: string;
};

export async function listOutputs(projectId: string): Promise<Output[]> {
  const body = await apiGet<{ outputs: Output[] }>(`/projects/${projectId}/outputs`);
  return body.outputs;
}

export async function runOutput(
  projectId: string,
  kind: OutputKind,
): Promise<Output> {
  const body = await apiPost<{ output: Output }>(
    `/projects/${projectId}/outputs`,
    { kind },
  );
  return body.output;
}

/* -- Tasks ------------------------------------------------------------- */

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "done"
  | "cancelled";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export type Task = {
  id: string;
  project_id: string;
  title: string;
  assignee_name: string | null;
  priority: TaskPriority;
  technical_specifications: string | null;
  status: TaskStatus;
  source: "manual" | "dictation" | "design";
  created_at: string;
};

export async function listTasks(projectId: string): Promise<Task[]> {
  const body = await apiGet<{ tasks: Task[] }>(`/projects/${projectId}/tasks`);
  return body.tasks;
}

export async function createTaskApi(
  projectId: string,
  input: {
    title: string;
    assignee_name?: string | null;
    priority?: TaskPriority;
    technical_specifications?: string | null;
    source?: "manual" | "dictation" | "design";
  },
): Promise<Task> {
  const body = await apiPost<{ task: Task }>(
    `/projects/${projectId}/tasks`,
    input,
  );
  return body.task;
}

export async function updateTaskStatusApi(
  projectId: string,
  taskId: string,
  status: TaskStatus,
): Promise<Task> {
  const body = await apiPatch<{ task: Task }>(
    `/projects/${projectId}/tasks/${taskId}/status`,
    { status },
  );
  return body.task;
}

/* -- Photo measurements ------------------------------------------------ */

export type PhotoMeasurementItem = {
  description: string;
  value: number;
  unit:
    | "meters"
    | "centimeters"
    | "millimeters"
    | "square_meters"
    | "cubic_meters"
    | "unknown";
  confidence: number;
  reference_used: string | null;
};

export type PhotoMeasurement = {
  id: string;
  project_id: string;
  image_uri: string;
  items: PhotoMeasurementItem[];
  notes: string | null;
  created_at: string;
};

export async function listPhotoMeasurements(
  projectId: string,
): Promise<PhotoMeasurement[]> {
  const body = await apiGet<{ measurements: PhotoMeasurement[] }>(
    `/projects/${projectId}/measurements`,
  );
  return body.measurements;
}

/* -- Recordings -------------------------------------------------------- */

export type Recording = {
  id: string;
  project_id: string;
  audio_uri: string;
  duration_s: number;
  transcript: string | null;
  transcription_confidence: number | null;
};

export async function listRecordings(projectId: string): Promise<Recording[]> {
  const body = await apiGet<{ recordings: Recording[] }>(
    `/projects/${projectId}/recordings`,
  );
  return body.recordings;
}

/* -- Accounting ------------------------------------------------------- */

export type AccountingStatus = {
  connected: boolean;
  mode: "live" | "dev_fallback";
  company_file_id?: string | null;
  tenant_id?: string | null;
  contacts_cached?: number;
  customers_cached?: number;
  items_cached?: number;
  sku_match_pct?: number;
  last_sync_at: string | null;
};

export async function getMyobStatus(): Promise<AccountingStatus | null> {
  try {
    return await apiGet<AccountingStatus>("/myob/status");
  } catch {
    return null;
  }
}

export async function getXeroStatus(): Promise<AccountingStatus | null> {
  try {
    return await apiGet<AccountingStatus>("/xero/status");
  } catch {
    return null;
  }
}

/* -- Carbon ----------------------------------------------------------- */

export type CarbonBreakdownLine = {
  sku: string;
  label: string;
  qty: number;
  unit: string;
  factor_kg_co2e: number;
  total_kg_co2e: number;
};

export type CarbonReport = {
  scenario: string;
  total_kg_co2e: number;
  by_category: Record<string, number>;
  lines: CarbonBreakdownLine[];
};

export async function getCarbon(projectId: string): Promise<CarbonReport | null> {
  try {
    return await apiGet<CarbonReport>(`/projects/${projectId}/carbon`);
  } catch {
    return null;
  }
}

/* -- Site context (season, sun, planning badges) ----------------------- */

export type TitlePlanningBadge = {
  id: string;
  category:
    | "tree_protection"
    | "stormwater"
    | "heritage"
    | "permit"
    | "council";
  label: string;
  severity: "likely" | "review" | "clear";
};

export type SiteContext = {
  fetched_at: string;
  season: { label: string; month: string; day_of_year: number };
  sun: {
    date_iso: string;
    sunrise_local: string;
    sunset_local: string;
    daylight_hours: number;
    solar_noon_altitude_deg: number;
    now_altitude_deg: number;
    now_azimuth_deg: number;
    now_azimuth_label: string;
    marker_x_pct: number;
    marker_y_pct: number;
  };
  planning_badges: TitlePlanningBadge[];
  weather_note?: string | null;
};

export async function getSiteContext(
  projectId: string,
): Promise<SiteContext | null> {
  try {
    const body = await apiGet<{ context: SiteContext }>(
      `/projects/${projectId}/site-context`,
    );
    return body.context;
  } catch {
    return null;
  }
}

/** Architectural title block · Vicmap cadastral for selected address. */
export type { ArchitecturalTitleBlock as CadastralTitleBlock } from "@workstream/domain";

export async function getCadastralTitle(
  projectId: string,
  address?: string,
): Promise<import("@workstream/domain").ArchitecturalTitleBlock | null> {
  try {
    const q =
      address && address.trim()
        ? `?address=${encodeURIComponent(address.trim())}`
        : "";
    const body = await apiGet<{
      titleBlock: import("@workstream/domain").ArchitecturalTitleBlock;
    }>(`/projects/${projectId}/cadastral-title${q}`);
    return body.titleBlock;
  } catch {
    return null;
  }
}

/* -- Weather ----------------------------------------------------------- */

export type WeatherDay = {
  date: string;
  temp_min_c: number;
  temp_max_c: number;
  precipitation_mm: number;
  precipitation_probability: number;
  wind_speed_kmh: number;
  condition: string;
};

export type WeatherForecast = {
  source: string;
  days: WeatherDay[];
};

export async function getWeather(
  projectId: string,
): Promise<WeatherForecast | null> {
  try {
    const body = await apiGet<{ forecast: WeatherForecast }>(
      `/projects/${projectId}/weather`,
    );
    return body.forecast;
  } catch {
    return null;
  }
}

/* -- Crew -------------------------------------------------------------- */

export type CrewRole =
  | "lead"
  | "senior"
  | "tradesperson"
  | "apprentice"
  | "labourer"
  | "subcontractor";

export type CrewMember = {
  id: string;
  owner_id: string;
  name: string;
  role: CrewRole;
  phone: string | null;
  email: string | null;
  hourly_rate: number;
  active: boolean;
  created_at: string;
};

export async function listCrew(): Promise<CrewMember[]> {
  const body = await apiGet<{ crew: CrewMember[] }>("/crew/");
  return body.crew;
}

export async function createCrewApi(input: {
  name: string;
  role?: CrewRole;
  phone?: string | null;
  email?: string | null;
  hourly_rate?: number;
}): Promise<CrewMember> {
  const body = await apiPost<{ member: CrewMember }>("/crew/", input);
  return body.member;
}

export async function deleteCrewApi(id: string): Promise<void> {
  await apiDelete(`/crew/${id}`);
}

/* -- Suppliers --------------------------------------------------------- */

export type SupplierPrice = {
  sku: string;
  label: string;
  unit: string;
  rate: number;
};

export type SupplierList = {
  supplier: string;
  fetched_at: string;
  prices: SupplierPrice[];
};

export async function listSuppliers(): Promise<SupplierList[]> {
  const body = await apiGet<{ suppliers: SupplierList[] }>("/suppliers/");
  return body.suppliers;
}

/* -- Rate card & plant palette ---------------------------------------- */

export type RateCardItem = {
  id: string;
  owner_id: string;
  category: string;
  sku: string;
  label: string;
  unit: string;
  rate: number;
  supplier?: string;
  notes?: string;
  effective_from: string;
};

export async function listRateCard(): Promise<RateCardItem[]> {
  const body = await apiGet<{ items: RateCardItem[]; count: number }>(
    "/settings/rate-card",
  );
  return body.items;
}

export async function updateRateCardItemApi(
  sku: string,
  patch: { rate?: number; notes?: string },
): Promise<RateCardItem> {
  const body = await apiPatch<{ item: RateCardItem }>(
    `/settings/rate-card/${sku}`,
    patch,
  );
  return body.item;
}

export type PlantPaletteItem = {
  id: string;
  owner_id: string;
  species: string;
  common_name: string;
  mature_h_m: number;
  mature_w_m: number;
  category: string;
  form?: string;
  use_description: string;
  climate_zones: string[];
  notes?: string;
  curtis_approved: boolean;
};

export async function listPlantPalette(): Promise<PlantPaletteItem[]> {
  const body = await apiGet<{ items: PlantPaletteItem[] }>(
    "/settings/plant-palette",
  );
  return body.items;
}

/* -- Integrations ------------------------------------------------------ */

export type IntegrationCategory =
  | "ai"
  | "payments"
  | "geo"
  | "auth"
  | "accounting"
  | "crm"
  | "email";

export type WorkspaceBilling = {
  owner_id: string;
  plan: "lite" | "studio";
  seat_limit: number;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  updated_at: string;
};

export type IntegrationSummary = {
  plan: "lite" | "studio";
  seat_limit: number;
  seats_used?: number;
  live_channels: number;
  total_channels: number;
  needs_attention: boolean;
  next_steps: Array<{
    id: string;
    label: string;
    href: string;
    done: boolean;
  }>;
};

export type WorkspaceMember = {
  workspace_id: string;
  user_id: string;
  role: "owner" | "operator";
  joined_at: string;
};

export type WorkspaceLicense = {
  product_name: "Design & Build License";
  plan: "lite" | "studio";
  seat_limit: number;
  seats_used: number;
  seats_available: number;
  live_integrations: boolean;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  members: WorkspaceMember[];
};

export type Integration = {
  key: string;
  label: string;
  description: string;
  category: IntegrationCategory;
  placeholder: string;
  channel: string | null;
  configured: boolean;
  live: boolean;
  source: "store" | "env" | "none";
  last4: string | null;
  length: number | null;
  updated_at: string | null;
};

export async function listIntegrations(): Promise<{
  items: Integration[];
  billing: WorkspaceBilling;
}> {
  const body = await apiGet<{ items: Integration[]; billing: WorkspaceBilling }>(
    "/settings/integrations",
  );
  return { items: body.items, billing: body.billing };
}

export type IntegrationChannelStatus = {
  channel: string;
  label: string;
  live: boolean;
  configured: boolean;
  note: string;
};

export type IntegrationEvent = {
  id: string;
  event: string;
  channel: string;
  ok: boolean;
  detail: string;
  created_at: string;
  project_id: string | null;
};

export async function getIntegrationSummary(): Promise<IntegrationSummary> {
  const body = await apiGet<{ summary: IntegrationSummary }>(
    "/integrations/summary",
  );
  return body.summary;
}

export async function getIntegrationHub(): Promise<{
  billing: WorkspaceBilling;
  channels: IntegrationChannelStatus[];
  events: IntegrationEvent[];
  summary: IntegrationSummary;
  license?: WorkspaceLicense;
}> {
  return apiGet("/integrations/hub");
}

export async function getWorkspaceLicenseApi(): Promise<{
  license: WorkspaceLicense;
  studio_price_configured: boolean;
  seat_price_configured: boolean;
}> {
  return apiGet("/integrations/license");
}

export async function startStudioCheckoutApi(): Promise<{
  checkout_url: string;
  mode: "live" | "dev_fallback";
}> {
  const webBase =
    process.env.NEXT_PUBLIC_WEB_URL ??
    process.env.PORTAL_BASE_URL ??
    "http://localhost:3002";
  return apiPost("/integrations/plan/checkout", {
    success_url: `${webBase}/settings/license?studio=success`,
    cancel_url: `${webBase}/settings/license?studio=cancel`,
  });
}

export async function startSeatCheckoutApi(
  extraSeats = 1,
): Promise<{
  checkout_url: string;
  mode: "live" | "dev_fallback";
  seat_limit: number;
}> {
  const webBase =
    process.env.NEXT_PUBLIC_WEB_URL ??
    process.env.PORTAL_BASE_URL ??
    "http://localhost:3002";
  return apiPost("/integrations/plan/seats/checkout", {
    extra_seats: extraSeats,
    success_url: `${webBase}/settings/license?seats=success`,
    cancel_url: `${webBase}/settings/license?seats=cancel`,
  });
}

export async function inviteWorkspaceMemberApi(
  userId: string,
): Promise<{ license: WorkspaceLicense }> {
  return apiPost("/integrations/license/members", { user_id: userId });
}

export async function removeWorkspaceMemberApi(
  userId: string,
): Promise<{ license: WorkspaceLicense }> {
  return apiDelete(`/integrations/license/members/${encodeURIComponent(userId)}`);
}

export async function createPortalLinkApi(
  projectId: string,
): Promise<{ portal_url: string }> {
  return apiPost(`/projects/${projectId}/magic-link`, {
    scope: "quote_view",
  });
}

export async function listShareRevisionsApi(projectId: string) {
  return apiGet<{
    revisions: import("@workstream/contracts").ShareRevision[];
    share_base_url: string;
  }>(`/projects/${projectId}/share-revisions`);
}

export type CreateShareRevisionResult =
  | {
      ok: true;
      revision: import("@workstream/contracts").ShareRevision;
      share_url: string;
    }
  | {
      ok: false;
      unchanged: true;
      revision: import("@workstream/contracts").ShareRevision;
      share_url: string;
      error: string;
    };

export async function createShareRevisionApi(
  projectId: string,
  body: import("@workstream/contracts").CreateShareRevisionInput,
): Promise<CreateShareRevisionResult> {
  const res = await fetch(`${API_URL}/projects/${projectId}/share-revisions`, {
    method: "POST",
    headers: await apiHeaders(true),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    revision?: import("@workstream/contracts").ShareRevision;
    share_url?: string;
    error?: string;
    unchanged?: boolean;
  };
  if (res.status === 409 && data.unchanged && data.revision && data.share_url) {
    return {
      ok: false,
      unchanged: true,
      revision: data.revision,
      share_url: data.share_url,
      error: data.error ?? "Nothing changed since the last share",
    };
  }
  if (!res.ok || !data.revision || !data.share_url) {
    throw new Error(
      data.error ?? `API ${res.status} on POST share-revisions`,
    );
  }
  return { ok: true, revision: data.revision, share_url: data.share_url };
}

export async function testIntegrationApi(
  channel: string,
  toEmail?: string,
): Promise<{ ok: boolean; detail: string }> {
  const body = await apiPost<{ ok: boolean; detail: string }>(
    "/integrations/hub/test",
    { channel, to_email: toEmail },
  );
  return { ok: body.ok, detail: body.detail };
}

export async function upgradeWorkspacePlanApi(
  plan: "lite" | "studio",
): Promise<WorkspaceBilling> {
  const body = await apiPost<{ billing: WorkspaceBilling }>(
    "/integrations/plan/upgrade",
    { plan },
  );
  return body.billing;
}

export async function syncProjectIntegrationsApi(
  projectId: string,
  input: {
    to_email?: string;
    client_name?: string;
    include_portal?: boolean;
  },
): Promise<{ ok: boolean; crm: boolean; email: boolean }> {
  return apiPost(`/projects/${projectId}/integrations/sync`, input);
}

export async function setIntegrationApi(
  key: string,
  value: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/settings/integrations/${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
}

export async function deleteIntegrationApi(key: string): Promise<void> {
  await apiDelete(`/settings/integrations/${key}`);
}

/* -- Filing / gallery ------------------------------------------------- */

export type GalleryItem = {
  id: string;
  source: "filing" | "aerial" | "measurement" | "output";
  kind: string;
  title: string;
  mime_type: string;
  uri: string;
  viewable: boolean;
  created_at: string;
};

export type ProjectFileKind =
  | "plan"
  | "design"
  | "site_photo"
  | "permit"
  | "reference"
  | "other";

export type ProjectFile = {
  id: string;
  project_id: string;
  owner_id: string;
  kind: ProjectFileKind;
  title: string;
  mime_type: string;
  uri: string;
  created_at: string;
};

export async function getProjectGallery(projectId: string): Promise<{
  items: GalleryItem[];
  viewable: GalleryItem[];
}> {
  return apiGet(`/projects/${projectId}/gallery`);
}

export async function listProjectFiles(
  projectId: string,
): Promise<ProjectFile[]> {
  const body = await apiGet<{ files: ProjectFile[] }>(
    `/projects/${projectId}/files`,
  );
  return body.files;
}

/* -- Activity audit trail ---------------------------------------------- */

export type ActivityEvent = {
  id: string;
  owner_id: string;
  project_id: string | null;
  action:
    | "project.deleted"
    | "project.restored"
    | "project_file.deleted"
    | "crew_member.deleted"
    | "catalog_symbol.deleted"
    | "integration.deleted"
    | "sku_link.deleted";
  subject_id: string | null;
  detail: string;
  created_at: string;
};

export async function listProjectActivity(
  projectId: string,
): Promise<ActivityEvent[]> {
  const body = await apiGet<{ events: ActivityEvent[] }>(
    `/projects/${projectId}/activity`,
  );
  return body.events;
}

export async function listWorkspaceActivity(): Promise<ActivityEvent[]> {
  const body = await apiGet<{ events: ActivityEvent[] }>("/settings/activity");
  return body.events;
}

