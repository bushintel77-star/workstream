import type {
  Audit,
  Costing,
  CreateOverrideInput,
  CreateProjectInput,
  Design,
  Output,
  OutputKind,
  Override,
  PlantPalette,
  Project,
  RateCard,
  Recording,
  Survey,
} from "@walkthrough/contracts";

export type ApiClientOptions = {
  baseUrl: string;
  getToken?: () => Promise<string | null>;
};

export class WalkthroughClient {
  constructor(private options: ApiClientOptions) {}

  async healthz(): Promise<{ status: string; timestamp: string }> {
    return this.request("GET", "/healthz");
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

  async listRateCard(): Promise<RateCard[]> {
    const res = await this.request<{ items: RateCard[] }>(
      "GET",
      "/settings/rate-card"
    );
    return res.items;
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
