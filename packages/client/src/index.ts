import type {
  Audit,
  Costing,
  CreateCrewMemberInput,
  CreateOverrideInput,
  CatalogPlacement,
  CatalogSymbol,
  CreateProjectInput,
  CreateTaskInput,
  CrewMember,
  Design,
  CadDocument,
  DesignCanvas,
  UpsertDesignCanvasInput,
  DesignGhostsResponse,
  CreateCatalogSymbolInput,
  MyobCustomer,
  MyobItem,
  MyobSyncStatus,
  Output,
  OutputKind,
  Override,
  PhotoMeasurement,
  PlantPalette,
  Project,
  ProjectMyobLink,
  ProjectStatus,
  RateCard,
  Recording,
  SkuLink,
  Survey,
  Task,
  TaskStatus,
  UpdateCrewMemberInput,
  UpsertSkuLinkInput,
  DesignAssistResponse,
  VoiceIntentKind,
  VoiceIntentSource,
} from "@workstream/contracts";

export type ApiClientOptions = {
  baseUrl: string;
  getToken?: () => Promise<string | null>;
};

export class WorkstreamClient {
  constructor(private options: ApiClientOptions) { }

  async healthz(): Promise<{ status: string; timestamp: string }> {
    return this.request("GET", "/healthz");
  }

  async geocodePreview(
    lat: number,
    lng: number,
  ): Promise<{
    neighbourhood_uri: string;
    aerial_uri: string;
    lat: number;
    lng: number;
  }> {
    return this.request(
      "GET",
      `/geocode/preview?lat=${lat}&lng=${lng}`,
    );
  }

  async updateProjectStatus(
    projectId: string,
    status: ProjectStatus,
  ): Promise<Project> {
    const res = await this.request<{ project: Project }>(
      "PATCH",
      `/projects/${projectId}/status`,
      { status },
    );
    return res.project;
  }

  async geocodeSearch(query: string): Promise<
    Array<{
      id: string;
      place_name: string;
      text: string;
      lat: number;
      lng: number;
    }>
  > {
    const res = await this.request<{
      suggestions: Array<{
        id: string;
        place_name: string;
        text: string;
        lat: number;
        lng: number;
      }>;
    }>("GET", `/geocode/search?q=${encodeURIComponent(query)}`);
    return res.suggestions;
  }

  async listProjects(): Promise<Project[]> {
    const res = await this.request<{ projects: Project[] }>(
      "GET",
      "/projects"
    );
    return res.projects;
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const res = await this.request<{ project: Project }>(
      "POST",
      "/projects",
      input
    );
    return res.project;
  }

  async getProject(id: string): Promise<Project> {
    const res = await this.request<{ project: Project }>(
      "GET",
      `/projects/${id}`
    );
    return res.project;
  }

  async deleteProject(id: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (this.options.getToken) {
      const token = await this.options.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${this.options.baseUrl}/projects/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok && res.status !== 204) {
      throw new Error(
        `DELETE /projects/${id} failed: ${res.status} ${await res.text()}`,
      );
    }
  }

  async listRateCard(): Promise<RateCard[]> {
    const res = await this.request<{ items: RateCard[] }>(
      "GET",
      "/settings/rate-card"
    );
    return res.items;
  }

  async updateRateCardItem(
    sku: string,
    patch: { rate?: number; notes?: string },
  ): Promise<RateCard> {
    const res = await this.request<{ item: RateCard }>(
      "PATCH",
      `/settings/rate-card/${encodeURIComponent(sku)}`,
      patch,
    );
    return res.item;
  }

  async listPlantPalette(): Promise<PlantPalette[]> {
    const res = await this.request<{ items: PlantPalette[] }>(
      "GET",
      "/settings/plant-palette"
    );
    return res.items;
  }

  async listRecordings(projectId: string): Promise<Recording[]> {
    const res = await this.request<{ recordings: Recording[] }>(
      "GET",
      `/projects/${projectId}/recordings`
    );
    return res.recordings;
  }

  async retryCapturePipeline(projectId: string): Promise<{ accepted: boolean; retry_from: string }> {
    return this.request("POST", `/projects/${projectId}/pipeline/retry`);
  }

  async createOverride(
    projectId: string,
    input: CreateOverrideInput,
  ): Promise<{ override: Override; audit: Audit }> {
    return this.request(
      "POST",
      `/projects/${projectId}/overrides`,
      input,
    );
  }

  async listOverrides(projectId: string): Promise<Override[]> {
    const res = await this.request<{ overrides: Override[] }>(
      "GET",
      `/projects/${projectId}/overrides`
    );
    return res.overrides;
  }

  async submitVoiceIntent(
    projectId: string,
    transcript: string,
    options: {
      confidence?: number;
      source?: VoiceIntentSource;
    } = {},
  ): Promise<{
    kind: VoiceIntentKind;
    transcript: string;
    confidence: number | null;
    reply: string;
    design: DesignAssistResponse | null;
    events: unknown[];
    dil_recorded: false;
  }> {
    const trimmed = transcript.trim();
    const kind: VoiceIntentKind = /\b(add|create|draw|place|move|align|path|bed|plant|planting|paving|deck|lawn|hedge|tree|garden|north|south|east|west|setback|wide|metre|meter|m)\b/i.test(
      trimmed,
    )
      ? "design"
      : "dictation";
    if (kind === "design") {
      const design = await this.request<DesignAssistResponse>(
        "POST",
        `/projects/${projectId}/design/assist`,
        { message: trimmed },
      );
      return {
        kind,
        transcript: trimmed,
        confidence: options.confidence ?? null,
        reply: design.reply,
        design,
        events: [],
        dil_recorded: false,
      };
    }
    const dictation = await this.runDictation(projectId, trimmed);
    return {
      kind,
      transcript: trimmed,
      confidence: options.confidence ?? null,
      reply: dictation.reply,
      design: null,
      events: dictation.events,
      dil_recorded: false,
    };
  }

  async runDictation(
    projectId: string,
    transcript: string,
  ): Promise<{
    reply: string;
    events: Array<
      | { kind: "task_created"; task_id: string; payload: CreateTaskInput }
      | {
        kind: "ledger_updated";
        entry: {
          id: string;
          material_type: string;
          measurement_type:
          | "area_sqm"
          | "volume_cum"
          | "linear_meters"
          | "unit_count";
          quantity: number;
          zone: string | null;
          created_at: string;
        };
      }
    >;
  }> {
    return this.request("POST", `/projects/${projectId}/dictation`, {
      transcript,
    });
  }

  async getSiteContext(projectId: string): Promise<{
    context: import("@workstream/contracts").SiteContext;
  }> {
    return this.request("GET", `/projects/${projectId}/site-context`);
  }

  async getWeather(projectId: string): Promise<{
    forecast: {
      fetched_at: string;
      days: Array<{
        date: string;
        precipitation_mm: number;
        temp_max_c: number;
        temp_min_c: number;
        wind_max_kph: number;
        humidity_pct: number | null;
      }>;
      rain_within_24h: boolean;
      wind_warning: boolean;
      source: "open-meteo" | "dev_fallback";
    };
  }> {
    return this.request("GET", `/projects/${projectId}/weather`);
  }

  async listMeasurements(projectId: string): Promise<PhotoMeasurement[]> {
    const res = await this.request<{ measurements: PhotoMeasurement[] }>(
      "GET",
      `/projects/${projectId}/measurements`,
    );
    return res.measurements;
  }

  async measurePhoto(
    projectId: string,
    fileUri: string,
    mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
    hint?: string,
  ): Promise<PhotoMeasurement> {
    const form = new FormData();
    const ext =
      mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    form.append("file", {
      uri: fileUri,
      type: mimeType,
      name: `measurement.${ext}`,
    } as unknown as Blob);
    if (hint) form.append("hint", hint);

    const headers: Record<string, string> = {};
    if (this.options.getToken) {
      const token = await this.options.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(
      `${this.options.baseUrl}/projects/${projectId}/measurements/photo`,
      { method: "POST", headers, body: form },
    );
    if (!res.ok) {
      throw new Error(
        `POST /projects/${projectId}/measurements/photo failed: ${res.status} ${await res.text()}`,
      );
    }
    const json = (await res.json()) as { measurement: PhotoMeasurement };
    return json.measurement;
  }

  async listCrew(): Promise<CrewMember[]> {
    const res = await this.request<{ crew: CrewMember[] }>("GET", "/crew");
    return res.crew;
  }

  async createCrewMember(input: CreateCrewMemberInput): Promise<CrewMember> {
    const res = await this.request<{ member: CrewMember }>(
      "POST",
      "/crew",
      input,
    );
    return res.member;
  }

  async updateCrewMember(
    id: string,
    patch: UpdateCrewMemberInput,
  ): Promise<CrewMember> {
    const res = await this.request<{ member: CrewMember }>(
      "PATCH",
      `/crew/${id}`,
      patch,
    );
    return res.member;
  }

  async deleteCrewMember(id: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (this.options.getToken) {
      const token = await this.options.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${this.options.baseUrl}/crew/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok && res.status !== 204) {
      throw new Error(`DELETE /crew/${id} failed: ${res.status}`);
    }
  }

  async myobStatus(): Promise<MyobSyncStatus> {
    return this.request("GET", "/myob/status");
  }

  async myobCustomers(): Promise<MyobCustomer[]> {
    const res = await this.request<{ customers: MyobCustomer[] }>(
      "GET",
      "/myob/customers",
    );
    return res.customers;
  }

  async myobItems(): Promise<MyobItem[]> {
    const res = await this.request<{ items: MyobItem[] }>(
      "GET",
      "/myob/items",
    );
    return res.items;
  }

  async myobSkuLinks(): Promise<SkuLink[]> {
    const res = await this.request<{ links: SkuLink[] }>(
      "GET",
      "/myob/sku-links",
    );
    return res.links;
  }

  async myobUpsertSkuLink(input: UpsertSkuLinkInput): Promise<SkuLink> {
    const res = await this.request<{ link: SkuLink }>(
      "PUT",
      "/myob/sku-links",
      input,
    );
    return res.link;
  }

  async myobLinkProjectCustomer(
    projectId: string,
    myob_customer_uid: string,
  ): Promise<ProjectMyobLink> {
    const res = await this.request<{ link: ProjectMyobLink }>(
      "POST",
      `/myob/projects/${projectId}/customer`,
      { myob_customer_uid },
    );
    return res.link;
  }

  async myobDraftInvoice(projectId: string): Promise<{
    invoice_uid: string;
    invoice_number: string;
    mode: "live" | "dev_fallback";
    total_incl_gst: number;
  }> {
    const res = await this.request<{
      invoice: {
        invoice_uid: string;
        invoice_number: string;
        mode: "live" | "dev_fallback";
        total_incl_gst: number;
      };
    }>("POST", `/myob/projects/${projectId}/invoice`);
    return res.invoice;
  }

  async getEnvelopeBrief(
    projectId: string,
  ): Promise<import("@workstream/domain").EnvelopeBrief | null> {
    try {
      const res = await this.request<{
        envelope: import("@workstream/domain").EnvelopeBrief;
      }>("GET", `/projects/${projectId}/envelope`);
      return res.envelope;
    } catch {
      return null;
    }
  }

  async createPortalLink(
    projectId: string,
  ): Promise<{ portal_url: string }> {
    return this.request("POST", `/projects/${projectId}/magic-link`, {
      scope: "quote_view",
    });
  }

  async getProjectGallery(projectId: string): Promise<{
    items: Array<{
      id: string;
      title: string;
      uri: string;
      mime_type: string;
      viewable: boolean;
    }>;
    viewable: Array<{
      id: string;
      title: string;
      uri: string;
      mime_type: string;
      viewable: boolean;
    }>;
  }> {
    return this.request("GET", `/projects/${projectId}/gallery`);
  }

  async listTasks(projectId: string): Promise<Task[]> {
    const res = await this.request<{ tasks: Task[] }>(
      "GET",
      `/projects/${projectId}/tasks`
    );
    return res.tasks;
  }

  async createTask(projectId: string, input: CreateTaskInput): Promise<Task> {
    const res = await this.request<{ task: Task }>(
      "POST",
      `/projects/${projectId}/tasks`,
      input,
    );
    return res.task;
  }

  async updateTaskStatus(
    projectId: string,
    taskId: string,
    status: TaskStatus,
  ): Promise<Task> {
    const res = await this.request<{ task: Task }>(
      "PATCH",
      `/projects/${projectId}/tasks/${taskId}/status`,
      { status },
    );
    return res.task;
  }

  async runPipeline(projectId: string): Promise<{ accepted: true }> {
    return this.request("POST", `/projects/${projectId}/pipeline`);
  }

  async runOutput(projectId: string, kind: OutputKind): Promise<Output> {
    const res = await this.request<{ output: Output }>(
      "POST",
      `/projects/${projectId}/outputs`,
      { kind }
    );
    return res.output;
  }

  async listOutputs(projectId: string): Promise<Output[]> {
    const res = await this.request<{ outputs: Output[] }>(
      "GET",
      `/projects/${projectId}/outputs`
    );
    return res.outputs;
  }

  async runAudit(projectId: string): Promise<Audit> {
    const res = await this.request<{ audit: Audit }>(
      "POST",
      `/projects/${projectId}/audit`
    );
    return res.audit;
  }

  async getAudit(projectId: string): Promise<Audit | null> {
    const headers: Record<string, string> = {};
    if (this.options.getToken) {
      const token = await this.options.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(
      `${this.options.baseUrl}/projects/${projectId}/audit`,
      { method: "GET", headers }
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        `GET /projects/${projectId}/audit failed: ${res.status} ${await res.text()}`
      );
    }
    const json = (await res.json()) as { audit: Audit };
    return json.audit;
  }

  async runCosting(projectId: string): Promise<Costing[]> {
    const res = await this.request<{ costings: Costing[] }>(
      "POST",
      `/projects/${projectId}/costing`
    );
    return res.costings;
  }

  async listCostings(projectId: string): Promise<Costing[]> {
    const res = await this.request<{ costings: Costing[] }>(
      "GET",
      `/projects/${projectId}/costing`
    );
    return res.costings;
  }

  async runDesign(projectId: string): Promise<Design> {
    const res = await this.request<{ design: Design }>(
      "POST",
      `/projects/${projectId}/design`
    );
    return res.design;
  }

  async getDesign(projectId: string): Promise<Design | null> {
    const headers: Record<string, string> = {};
    if (this.options.getToken) {
      const token = await this.options.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(
      `${this.options.baseUrl}/projects/${projectId}/design`,
      { method: "GET", headers }
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        `GET /projects/${projectId}/design failed: ${res.status} ${await res.text()}`
      );
    }
    const json = (await res.json()) as { design: Design };
    return json.design;
  }

  async listCatalogSymbols(): Promise<CatalogSymbol[]> {
    const res = await this.request<{ symbols: CatalogSymbol[] }>(
      "GET",
      "/catalog/symbols",
    );
    return res.symbols;
  }

  async createCatalogSymbol(
    input: CreateCatalogSymbolInput,
  ): Promise<CatalogSymbol> {
    const res = await this.request<{ symbol: CatalogSymbol }>(
      "POST",
      "/catalog/symbols",
      input,
    );
    return res.symbol;
  }

  async deleteCatalogSymbol(id: string): Promise<void> {
    await this.request("DELETE", `/catalog/symbols/${id}`);
  }

  async getDesignCanvas(projectId: string): Promise<DesignCanvas | null> {
    const res = await this.request<{
      canvas: DesignCanvas & { id: string | null };
    }>("GET", `/projects/${projectId}/design-canvas`);
    if (!res.canvas?.id) return null;
    return res.canvas as DesignCanvas;
  }

  async saveDesignCanvas(
    projectId: string,
    input: UpsertDesignCanvasInput,
  ): Promise<DesignCanvas> {
    const res = await this.request<{ canvas: DesignCanvas }>(
      "PUT",
      `/projects/${projectId}/design-canvas`,
      input,
    );
    return res.canvas;
  }

  async scanDesignGhosts(projectId: string): Promise<DesignGhostsResponse> {
    return this.request("POST", `/projects/${projectId}/design/ghosts`);
  }

  async getCadDocument(projectId: string): Promise<{
    document: CadDocument | null;
    svg: string | null;
    ghost_count: number;
  }> {
    return this.request("GET", `/projects/${projectId}/cad`);
  }

  async generateCad(projectId: string): Promise<{
    document: CadDocument;
    svg: string;
    ghost_count: number;
    rationale: string;
    applied: number;
  }> {
    return this.request("POST", `/projects/${projectId}/cad/generate`, {});
  }

  async editCad(
    projectId: string,
    instruction: string,
  ): Promise<{
    document: CadDocument;
    svg: string;
    ghost_count: number;
    rationale: string;
    applied: number;
  }> {
    return this.request("POST", `/projects/${projectId}/cad/edit`, {
      instruction,
    });
  }

  async acceptCad(
    projectId: string,
    entityIds?: string[],
  ): Promise<{
    document: CadDocument;
    svg: string;
    ghost_count: number;
  }> {
    return this.request("POST", `/projects/${projectId}/cad/accept`, {
      entity_ids: entityIds,
    });
  }

  async runSurvey(projectId: string): Promise<Survey> {
    const res = await this.request<{ survey: Survey }>(
      "POST",
      `/projects/${projectId}/survey`
    );
    return res.survey;
  }

  async getSurvey(projectId: string): Promise<Survey | null> {
    const headers: Record<string, string> = {};
    if (this.options.getToken) {
      const token = await this.options.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(
      `${this.options.baseUrl}/projects/${projectId}/survey`,
      { method: "GET", headers }
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        `GET /projects/${projectId}/survey failed: ${res.status} ${await res.text()}`
      );
    }
    const json = (await res.json()) as { survey: Survey };
    return json.survey;
  }

  async uploadRecording(
    projectId: string,
    fileUri: string,
    durationS: number,
    mimeType = "audio/m4a",
    dilConsent = false,
  ): Promise<Recording> {
    const form = new FormData();
    const ext = mimeType.includes("webm") ? "webm" : "m4a";
    form.append("file", {
      uri: fileUri,
      type: mimeType,
      name: `recording.${ext}`,
    } as unknown as Blob);
    form.append("duration_s", String(Math.round(durationS)));
    form.append("dil_consent", String(dilConsent));

    const headers: Record<string, string> = {};
    if (this.options.getToken) {
      const token = await this.options.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const res = await fetch(
      `${this.options.baseUrl}/projects/${projectId}/recordings`,
      {
        method: "POST",
        headers,
        body: form,
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST /projects/${projectId}/recordings failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as { recording: Recording };
    return json.recording;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    // Fastify rejects `Content-Type: application/json` with an empty body.
    // Only set the header when we actually serialize a payload.
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (this.options.getToken) {
      const token = await this.options.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const res = await fetch(`${this.options.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${method} ${path} failed: ${res.status} ${text}`);
    }

    return res.json() as Promise<T>;
  }
}
