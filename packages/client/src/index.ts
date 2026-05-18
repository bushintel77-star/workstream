import type {
  Audit,
  Costing,
  CreateCrewMemberInput,
  CreateOverrideInput,
  CreateProjectInput,
  CreateTaskInput,
  CrewMember,
  Design,
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
  RateCard,
  Recording,
  SkuLink,
  Survey,
  Task,
  TaskStatus,
  UpdateCrewMemberInput,
  UpsertSkuLinkInput,
} from "@construct/contracts";

export type ApiClientOptions = {
  baseUrl: string;
  getToken?: () => Promise<string | null>;
};

export class ConstructClient {
  constructor(private options: ApiClientOptions) {}

  async healthz(): Promise<{ status: string; timestamp: string }> {
    return this.request("GET", "/healthz");
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

  async getWeather(projectId: string): Promise<{
    forecast: {
      fetched_at: string;
      days: Array<{
        date: string;
        precipitation_mm: number;
        temp_max_c: number;
        temp_min_c: number;
        wind_max_kph: number;
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

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    const res = await this.request<{ task: Task }>(
      "PATCH",
      `/projects/tasks/${taskId}/status`,
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
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
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
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
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

  async runSurvey(projectId: string): Promise<Survey> {
    const res = await this.request<{ survey: Survey }>(
      "POST",
      `/projects/${projectId}/survey`
    );
    return res.survey;
  }

  async getSurvey(projectId: string): Promise<Survey | null> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
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
    mimeType = "audio/m4a"
  ): Promise<Recording> {
    const form = new FormData();
    const ext = mimeType.includes("webm") ? "webm" : "m4a";
    form.append("file", {
      uri: fileUri,
      type: mimeType,
      name: `recording.${ext}`,
    } as unknown as Blob);
    form.append("duration_s", String(Math.round(durationS)));

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
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.options.getToken) {
      const token = await this.options.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const res = await fetch(`${this.options.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${method} ${path} failed: ${res.status} ${text}`);
    }

    return res.json() as Promise<T>;
  }
}
