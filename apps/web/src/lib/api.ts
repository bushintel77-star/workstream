const API_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} on GET ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : {},
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} on PATCH ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`API ${res.status} on DELETE ${path}`);
  }
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

export type Project = {
  id: string;
  owner_id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  created_at: string;
  status: ProjectStatus;
};

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

/* -- Survey ------------------------------------------------------------ */

export type Survey = {
  id: string;
  project_id: string;
  aerial_uri: string;
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
  },
): Promise<Task> {
  const body = await apiPost<{ task: Task }>(
    `/projects/${projectId}/tasks`,
    input,
  );
  return body.task;
}

export async function updateTaskStatusApi(
  taskId: string,
  status: TaskStatus,
): Promise<Task> {
  const body = await apiPatch<{ task: Task }>(`/projects/tasks/${taskId}/status`, {
    status,
  });
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

export type Integration = {
  key: string;
  label: string;
  description: string;
  category: "ai" | "payments" | "geo" | "auth" | "accounting";
  placeholder: string;
  configured: boolean;
  source: "store" | "env" | "none";
  last4: string | null;
  length: number | null;
  updated_at: string | null;
};

export async function listIntegrations(): Promise<Integration[]> {
  const body = await apiGet<{ items: Integration[] }>("/settings/integrations");
  return body.items;
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

/* -- Portal links (studio → client) ----------------------------------- */

export type PortalLinkScope = "quote_view" | "deposit_checkout" | "change_request";

export async function createPortalMagicLink(
  projectId: string,
  scope: PortalLinkScope = "quote_view",
): Promise<{ token: string; portal_url: string; scope: PortalLinkScope }> {
  return apiPost(`/projects/${projectId}/magic-link`, { scope });
}

/* -- Portal (client-facing) ------------------------------------------- */

export async function fetchPortalQuote(token: string): Promise<
  import("../components/QuotePortal").PortalQuoteData | { error: string }
> {
  const res = await fetch(`${API_URL}/portal/quote/${token}`, {
    cache: "no-store",
  });
  if (!res.ok) return { error: `Portal returned ${res.status}` };
  return res.json();
}

export async function createDepositCheckout(token: string): Promise<{
  session?: {
    session_id: string;
    checkout_url: string;
    deposit_amount_aud: number;
    mode: "live" | "dev_fallback";
  };
  error?: string;
}> {
  const res = await fetch(`${API_URL}/portal/deposit/${token}`, {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) return { error: `Portal returned ${res.status}` };
  return res.json();
}
