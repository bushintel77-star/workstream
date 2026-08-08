import type {
  Audit,
  Costing,
  CreateProjectInput,
  CrewMember,
  Design,
  IntegrationSecret,
  Output,
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
} from "./types";
import type { Store } from "./types";
import { loadSnapshotInto, makeFlusher } from "./persist";

export const SYSTEM_OWNER = "system";

export type CreateStoreOptions = {
  persistPath?: string;
};

export function createMemoryStore(opts: CreateStoreOptions = {}): Store & {
  _projects: Project[];
  _recordings: Recording[];
  _rateCard: RateCard[];
  _plantPalette: PlantPalette[];
  _surveys: Survey[];
  _designs: Design[];
  _costings: Costing[];
  _audits: Audit[];
  _outputs: Output[];
  _overrides: Override[];
  _tasks: Task[];
  _skuLinks: SkuLink[];
  _projectMyobLinks: ProjectMyobLink[];
  _crew: CrewMember[];
  _photoMeasurements: PhotoMeasurement[];
  _loadSnapshot: () => boolean;
} {
  const _projects: Project[] = [];
  const _recordings: Recording[] = [];
  const _rateCard: RateCard[] = [];
  const _plantPalette: PlantPalette[] = [];
  const _surveys: Survey[] = [];
  const _designs: Design[] = [];
  const _costings: Costing[] = [];
  const _audits: Audit[] = [];
  const _outputs: Output[] = [];
  const _overrides: Override[] = [];
  const _tasks: Task[] = [];
  const _skuLinks: SkuLink[] = [];
  const _projectMyobLinks: ProjectMyobLink[] = [];
  const _crew: CrewMember[] = [];
  const _photoMeasurements: PhotoMeasurement[] = [];
  const _integrations: IntegrationSecret[] = [];
  const _workspaceBilling: import("./types").WorkspaceBilling[] = [];
  const _workspaceMembers: import("./types").WorkspaceMember[] = [];
  const _integrationEvents: import("./types").IntegrationEvent[] = [];
  const _projectFiles: import("./types").ProjectFile[] = [];
  const _designCanvases: import("@workstream/contracts").DesignCanvas[] = [];
  const _cadDocuments: import("@workstream/contracts").CadDocument[] = [];
  const _orchestrationOverlays: import("@workstream/contracts").OrchestrationOverlayRecord[] =
    [];
  const _designBranches: import("@workstream/contracts").DesignBranchSnapshot[] =
    [];
  const _leftovers: import("@workstream/contracts").LeftoverStock[] = [];
  const _siteBoundaries: import("@workstream/contracts").SiteBoundary[] = [];
  const _catalogCustom: Array<
    import("@workstream/contracts").CatalogSymbol & { owner_id: string }
  > = [];
  const _activityEvents: import("./types").ActivityEvent[] = [];
  let seeded = false;

  function logActivity(
    ownerId: string,
    projectId: string | null,
    action: import("./types").ActivityAction,
    detail: string,
    subjectId: string | null = null,
  ): void {
    _activityEvents.push({
      id: crypto.randomUUID(),
      owner_id: ownerId,
      project_id: projectId,
      action,
      subject_id: subjectId,
      detail,
      created_at: new Date().toISOString(),
    });
  }

  const arrays = {
    _projects,
    _recordings,
    _rateCard,
    _plantPalette,
    _surveys,
    _designs,
    _costings,
    _audits,
    _outputs,
    _overrides,
    _tasks,
    _skuLinks,
    _projectMyobLinks,
    _crew,
    _photoMeasurements,
    _integrations,
    _workspaceBilling,
    _workspaceMembers,
    _integrationEvents,
    _projectFiles,
    _designCanvases,
    _cadDocuments,
    _orchestrationOverlays,
    _designBranches,
    _leftovers,
    _siteBoundaries,
    _catalogCustom,
    _activityEvents,
  };

  const flush = opts.persistPath
    ? makeFlusher(opts.persistPath, arrays as Record<string, unknown[]>)
    : () => {};

  const loadSnapshot = (): boolean => {
    if (!opts.persistPath) return false;
    const loaded = loadSnapshotInto(
      opts.persistPath,
      arrays as Record<string, unknown[]>,
    );
    if (loaded) {
      for (const link of _skuLinks) {
        const row = link as SkuLink & { construct_sku?: string };
        if (!row.rate_card_sku && row.construct_sku) {
          row.rate_card_sku = row.construct_sku;
        }
      }
      if (_rateCard.length > 0 && _plantPalette.length > 0) {
        seeded = true;
      }
    }
    return loaded;
  };

  return {
    _projects,
    _recordings,
    _rateCard,
    _plantPalette,
    _surveys,
    _designs,
    _costings,
    _audits,
    _outputs,
    _overrides,
    _tasks,
    _skuLinks,
    _projectMyobLinks,
    _crew,
    _photoMeasurements,
    _loadSnapshot: loadSnapshot,

    async seedDefaults() {
      if (seeded) return;
      const { seedRateCard, seedPlantPalette } = await import("./seed");
      _rateCard.push(...seedRateCard());
      _plantPalette.push(...seedPlantPalette());
      seeded = true;
      flush();
    },

    async listProjects(ownerId) {
      return _projects
        .filter((p) => p.owner_id === ownerId && !p.deleted_at)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    },

    async createProject(ownerId, input) {
      const project: Project = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        address: input.address,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        created_at: new Date().toISOString(),
        status: "draft",
        client_name: null,
        client_email: null,
        crm_stage: "enquiry",
        crm_synced_at: null,
        deleted_at: null,
      };
      _projects.push(project);
      flush();
      return project;
    },

    async getProject(ownerId, id) {
      const p = _projects.find(
        (x) => x.id === id && x.owner_id === ownerId && !x.deleted_at,
      );
      if (!p) return null;
      return {
        ...p,
        client_name: p.client_name ?? null,
        client_email: p.client_email ?? null,
        crm_stage: p.crm_stage ?? null,
        crm_synced_at: p.crm_synced_at ?? null,
      };
    },

    async updateProjectClient(ownerId, projectId, patch) {
      const p = _projects.find(
        (x) => x.id === projectId && x.owner_id === ownerId,
      );
      if (!p) return null;
      if (patch.client_name !== undefined) p.client_name = patch.client_name;
      if (patch.client_email !== undefined) p.client_email = patch.client_email;
      if (patch.crm_stage !== undefined) p.crm_stage = patch.crm_stage;
      flush();
      return { ...p };
    },

    async touchProjectCrmSync(ownerId, projectId) {
      const p = _projects.find(
        (x) => x.id === projectId && x.owner_id === ownerId,
      );
      if (!p) return null;
      p.crm_synced_at = new Date().toISOString();
      if (!p.crm_stage || p.crm_stage === "enquiry") {
        p.crm_stage = "quote_sent";
      }
      flush();
      return { ...p };
    },

    async resolveProjectOwner(projectId) {
      const p = _projects.find((x) => x.id === projectId && !x.deleted_at);
      return p?.owner_id ?? null;
    },

    async resolveAssetOwner(kind, assetId) {
      const ownerForProject = (projectId: string) => {
        const project = _projects.find((p) => p.id === projectId && !p.deleted_at);
        return project ? { ownerId: project.owner_id, projectId } : null;
      };

      switch (kind) {
        case "uploads": {
          const rec = _recordings.find((r) => r.id === assetId);
          return rec ? ownerForProject(rec.project_id) : null;
        }
        case "outputs": {
          const out = _outputs.find((o) => o.id === assetId);
          return out ? ownerForProject(out.project_id) : null;
        }
        case "photos": {
          const row = _photoMeasurements.find((m) =>
            m.image_uri.includes(assetId),
          );
          return row ? ownerForProject(row.project_id) : null;
        }
        case "aerial": {
          const survey = _surveys.find((s) =>
            s.aerial_uri?.includes(assetId),
          );
          return survey ? ownerForProject(survey.project_id) : null;
        }
        case "filings": {
          const file =
            _projectFiles.find((f) => f.id === assetId) ??
            _projectFiles.find((f) => f.uri.includes(assetId));
          return file ? ownerForProject(file.project_id) : null;
        }
        default:
          return null;
      }
    },

    reloadSnapshot() {
      loadSnapshot();
    },

    async deleteProject(ownerId, id) {
      const p = _projects.find(
        (x) => x.id === id && x.owner_id === ownerId && !x.deleted_at,
      );
      if (!p) return false;
      p.deleted_at = new Date().toISOString();
      logActivity(
        ownerId,
        id,
        "project.deleted",
        `Project "${p.address}" moved to trash`,
        id,
      );
      flush();
      return true;
    },

    async restoreProject(ownerId, id) {
      const p = _projects.find(
        (x) => x.id === id && x.owner_id === ownerId && x.deleted_at,
      );
      if (!p) return null;
      p.deleted_at = null;
      logActivity(
        ownerId,
        id,
        "project.restored",
        `Project "${p.address}" restored`,
        id,
      );
      flush();
      return p;
    },

    async updateProjectStatus(ownerId, projectId, status) {
      const p = _projects.find(
        (x) => x.id === projectId && x.owner_id === ownerId
      );
      if (!p) return null;
      p.status = status;
      flush();
      return p;
    },

    async listRecordings(ownerId, projectId) {
      const project = _projects.find(
        (x) => x.id === projectId && x.owner_id === ownerId
      );
      if (!project) return [];
      return _recordings
        .filter((r) => r.project_id === projectId)
        .sort(
          (a, b) =>
            new Date(b.id).getTime() - new Date(a.id).getTime()
        );
    },

    async createRecording(ownerId, projectId, audioUri, durationS) {
      const project = _projects.find(
        (x) => x.id === projectId && x.owner_id === ownerId
      );
      if (!project) return null;
      const recording: Recording = {
        id: crypto.randomUUID(),
        project_id: projectId,
        audio_uri: audioUri,
        duration_s: durationS,
        transcript: null,
        transcription_confidence: null,
      };
      _recordings.push(recording);
      project.status = "recording";
      flush();
      return recording;
    },

    async updateRecordingTranscript(recordingId, transcript, confidence) {
      const r = _recordings.find((x) => x.id === recordingId);
      if (!r) return null;
      r.transcript = transcript;
      r.transcription_confidence = confidence;
      flush();
      return r;
    },

    async getRecording(recordingId) {
      return _recordings.find((x) => x.id === recordingId) ?? null;
    },

    async listRateCard(ownerId) {
      const rows = _rateCard.filter(
        (r) => r.owner_id === SYSTEM_OWNER || r.owner_id === ownerId
      );
      return rows.sort((a, b) => a.sku.localeCompare(b.sku));
    },

    async updateRateCardItem(ownerId, sku, patch) {
      const visible = _rateCard.filter(
        (r) =>
          r.sku === sku &&
          (r.owner_id === ownerId || r.owner_id === SYSTEM_OWNER),
      );
      if (visible.length === 0) return null;
      const target = visible.find((r) => r.owner_id === ownerId) ?? visible[0];
      if (patch.rate != null) target.rate = patch.rate;
      if (patch.notes != null) target.notes = patch.notes;
      target.effective_from = new Date().toISOString();
      flush();
      return target;
    },

    async listPlantPalette(ownerId) {
      const rows = _plantPalette.filter(
        (p) => p.owner_id === SYSTEM_OWNER || p.owner_id === ownerId
      );
      return rows.sort((a, b) => a.species.localeCompare(b.species));
    },

    async upsertSurvey(ownerId, projectId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId
      );
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }
      const existing = _surveys.find((s) => s.project_id === projectId);
      if (existing) {
        Object.assign(existing, input);
        flush();
        return existing;
      }
      const survey: Survey = {
        id: crypto.randomUUID(),
        project_id: projectId,
        ...input,
      };
      _surveys.push(survey);
      flush();
      return survey;
    },

    async getSurvey(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId
      );
      if (!project) return null;
      return _surveys.find((s) => s.project_id === projectId) ?? null;
    },

    async upsertDesign(ownerId, projectId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId
      );
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }
      const existing = _designs.find((d) => d.project_id === projectId);
      if (existing) {
        const next: Design = {
          ...existing,
          ...input,
          version: existing.version + 1,
        };
        const idx = _designs.indexOf(existing);
        _designs[idx] = next;
        flush();
        return next;
      }
      const design: Design = {
        id: crypto.randomUUID(),
        project_id: projectId,
        version: 1,
        ...input,
      };
      _designs.push(design);
      flush();
      return design;
    },

    async getDesign(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId
      );
      if (!project) return null;
      return _designs.find((d) => d.project_id === projectId) ?? null;
    },

    async upsertCosting(ownerId, projectId, designId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);

      const existing = _costings.find(
        (c) => c.design_id === designId && c.scenario === input.scenario,
      );
      if (existing) {
        Object.assign(existing, input);
        flush();
        return existing;
      }
      const costing: Costing = {
        id: crypto.randomUUID(),
        design_id: designId,
        ...input,
      };
      _costings.push(costing);
      flush();
      return costing;
    },

    async listCostings(ownerId, projectId) {
      const design = _designs.find((d) => d.project_id === projectId);
      if (!design) return [];
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId
      );
      if (!project) return [];
      return _costings
        .filter((c) => c.design_id === design.id)
        .sort((a, b) => a.scenario.localeCompare(b.scenario));
    },

    async upsertAudit(ownerId, projectId, designId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);

      const existing = _audits.find((a) => a.design_id === designId);
      if (existing) {
        Object.assign(existing, input);
        flush();
        return existing;
      }
      const audit: Audit = {
        id: crypto.randomUUID(),
        design_id: designId,
        ...input,
      };
      _audits.push(audit);
      flush();
      return audit;
    },

    async getAudit(ownerId, projectId) {
      const design = _designs.find((d) => d.project_id === projectId);
      if (!design) return null;
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId
      );
      if (!project) return null;
      return _audits.find((a) => a.design_id === design.id) ?? null;
    },

    async upsertOutput(ownerId, projectId, kind, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);

      const existing = _outputs.find(
        (o) => o.project_id === projectId && o.kind === kind,
      );
      if (existing) {
        Object.assign(existing, input);
        flush();
        return existing;
      }
      const output: Output = {
        id: crypto.randomUUID(),
        project_id: projectId,
        kind,
        ...input,
      };
      _outputs.push(output);
      flush();
      return output;
    },

    async listOutputs(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId
      );
      if (!project) return [];
      return _outputs
        .filter((o) => o.project_id === projectId)
        .sort((a, b) => a.kind.localeCompare(b.kind));
    },

    async createOverride(ownerId, projectId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);

      const design = _designs.find((d) => d.project_id === projectId);
      if (!design) throw new Error("Audit not found for this project.");
      const audit = _audits.find((a) => a.design_id === design.id);
      if (!audit) throw new Error("Audit not found for this project.");

      const finding = audit.findings[input.finding_index];
      if (!finding) {
        throw new Error(
          `Finding index ${input.finding_index} out of range.`,
        );
      }
      if (finding.severity !== "blocking") {
        throw new Error("Only blocking findings can be overridden.");
      }

      const alreadyOverridden = _overrides.some(
        (o) =>
          o.audit_id === audit.id &&
          o.finding_index === input.finding_index,
      );
      if (alreadyOverridden) {
        throw new Error("This finding is already overridden.");
      }

      const override: Override = {
        id: crypto.randomUUID(),
        project_id: projectId,
        audit_id: audit.id,
        finding_index: input.finding_index,
        category: finding.category,
        location: finding.location,
        reason: input.reason,
        created_at: new Date().toISOString(),
      };
      _overrides.push(override);

      const overriddenCount = _overrides.filter(
        (o) => o.audit_id === audit.id,
      ).length;
      const remaining = audit.blocking_count - overriddenCount;
      audit.passed = remaining <= 0;

      flush();
      return { override, audit };
    },

    async listOverrides(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId
      );
      if (!project) return [];
      return _overrides
        .filter((o) => o.project_id === projectId)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        );
    },

    async createTask(ownerId, projectId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const task: Task = {
        id: crypto.randomUUID(),
        project_id: projectId,
        title: input.title,
        assignee_name: input.assignee_name ?? null,
        priority: input.priority ?? "medium",
        technical_specifications: input.technical_specifications ?? null,
        status: "pending",
        source: input.source ?? "manual",
        created_at: new Date().toISOString(),
      };
      _tasks.push(task);
      flush();
      return task;
    },

    async listTasks(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId
      );
      if (!project) return [];
      return _tasks
        .filter((t) => t.project_id === projectId)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        );
    },

    async updateTaskStatus(ownerId, taskId, status) {
      const task = _tasks.find((t) => t.id === taskId);
      if (!task) return null;
      const project = _projects.find(
        (p) => p.id === task.project_id && p.owner_id === ownerId
      );
      if (!project) return null;
      task.status = status;
      flush();
      return task;
    },

    async listSkuLinks(ownerId) {
      return _skuLinks
        .filter((l) => l.owner_id === ownerId)
        .sort((a, b) => a.rate_card_sku.localeCompare(b.rate_card_sku));
    },

    async upsertSkuLink(ownerId, input) {
      const existing = _skuLinks.find(
        (l) => l.owner_id === ownerId && l.rate_card_sku === input.rate_card_sku,
      );
      const now = new Date().toISOString();
      if (existing) {
        existing.myob_uid = input.myob_uid;
        existing.myob_item_number = input.myob_item_number;
        existing.last_synced_at = now;
        flush();
        return existing;
      }
      const link: SkuLink = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        rate_card_sku: input.rate_card_sku,
        myob_uid: input.myob_uid,
        myob_item_number: input.myob_item_number,
        last_synced_at: now,
      };
      _skuLinks.push(link);
      flush();
      return link;
    },

    async removeSkuLink(ownerId, rate_card_sku) {
      const idx = _skuLinks.findIndex(
        (l) => l.owner_id === ownerId && l.rate_card_sku === rate_card_sku,
      );
      if (idx < 0) return false;
      logActivity(
        ownerId,
        null,
        "sku_link.deleted",
        `MYOB SKU link "${rate_card_sku}" removed`,
        rate_card_sku,
      );
      _skuLinks.splice(idx, 1);
      flush();
      return true;
    },

    async getProjectMyobLink(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return null;
      return (
        _projectMyobLinks.find((l) => l.project_id === projectId) ?? null
      );
    },

    async listCrew(ownerId) {
      return _crew
        .filter((c) => c.owner_id === ownerId)
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async createCrewMember(ownerId, input) {
      const member: CrewMember = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        name: input.name,
        role: input.role ?? "tradesperson",
        phone: input.phone ?? null,
        email: input.email ?? null,
        hourly_rate: input.hourly_rate ?? 0,
        active: true,
        created_at: new Date().toISOString(),
      };
      _crew.push(member);
      flush();
      return member;
    },

    async updateCrewMember(ownerId, id, patch) {
      const member = _crew.find(
        (c) => c.id === id && c.owner_id === ownerId,
      );
      if (!member) return null;
      if (patch.name !== undefined) member.name = patch.name;
      if (patch.role !== undefined) member.role = patch.role;
      if (patch.phone !== undefined) member.phone = patch.phone ?? null;
      if (patch.email !== undefined) member.email = patch.email ?? null;
      if (patch.hourly_rate !== undefined)
        member.hourly_rate = patch.hourly_rate;
      if (patch.active !== undefined) member.active = patch.active;
      flush();
      return member;
    },

    async createPhotoMeasurement(ownerId, projectId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const row: PhotoMeasurement = {
        id: crypto.randomUUID(),
        ...input,
        created_at: new Date().toISOString(),
      };
      _photoMeasurements.push(row);
      flush();
      return row;
    },

    async listPhotoMeasurements(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return [];
      return _photoMeasurements
        .filter((m) => m.project_id === projectId)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        );
    },

    async listIntegrations(ownerId) {
      return _integrations
        .filter((i) => i.owner_id === ownerId)
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((i) => ({ ...i }));
    },

    async getIntegration(ownerId, key) {
      const found = _integrations.find(
        (i) => i.owner_id === ownerId && i.key === key,
      );
      return found ? { ...found } : null;
    },

    async setIntegration(ownerId, key, value) {
      const existing = _integrations.find(
        (i) => i.owner_id === ownerId && i.key === key,
      );
      const now = new Date().toISOString();
      if (existing) {
        existing.value = value;
        existing.updated_at = now;
        flush();
        return { ...existing };
      }
      const row: IntegrationSecret = {
        owner_id: ownerId,
        key,
        value,
        updated_at: now,
      };
      _integrations.push(row);
      flush();
      return { ...row };
    },

    async deleteIntegration(ownerId, key) {
      const idx = _integrations.findIndex(
        (i) => i.owner_id === ownerId && i.key === key,
      );
      if (idx < 0) return false;
      const row = _integrations[idx]!;
      logActivity(
        ownerId,
        null,
        "integration.deleted",
        `Integration "${row.key}" removed`,
        row.key,
      );
      _integrations.splice(idx, 1);
      flush();
      return true;
    },

    async getWorkspaceBilling(ownerId) {
      const found = _workspaceBilling.find((w) => w.owner_id === ownerId);
      if (found) {
        return {
          ...found,
          stripe_customer_id: found.stripe_customer_id ?? null,
          stripe_subscription_id: found.stripe_subscription_id ?? null,
        };
      }
      const row: import("./types").WorkspaceBilling = {
        owner_id: ownerId,
        plan: "lite",
        seat_limit: 1,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        updated_at: new Date().toISOString(),
      };
      _workspaceBilling.push(row);
      flush();
      return { ...row };
    },

    async setWorkspacePlan(ownerId, plan) {
      return this.patchWorkspaceBilling(ownerId, { plan });
    },

    async patchWorkspaceBilling(ownerId, patch) {
      const existing = await this.getWorkspaceBilling(ownerId);
      const idx = _workspaceBilling.findIndex((w) => w.owner_id === ownerId);
      const row: import("./types").WorkspaceBilling = {
        ...existing,
        ...patch,
        owner_id: ownerId,
        updated_at: new Date().toISOString(),
      };
      if (idx >= 0) _workspaceBilling[idx] = row;
      flush();
      return { ...row };
    },

    async listWorkspaceMembers(workspaceId) {
      return _workspaceMembers
        .filter((m) => m.workspace_id === workspaceId)
        .map((m) => ({ ...m }));
    },

    async countWorkspaceSeats(workspaceId) {
      return _workspaceMembers.filter((m) => m.workspace_id === workspaceId)
        .length;
    },

    async ensureWorkspaceMember(workspaceId, userId, role) {
      const existing = _workspaceMembers.find(
        (m) => m.workspace_id === workspaceId && m.user_id === userId,
      );
      if (existing) return { member: { ...existing }, created: false };

      const billing = await this.getWorkspaceBilling(workspaceId);
      const used = await this.countWorkspaceSeats(workspaceId);
      if (used >= billing.seat_limit) {
        const err = new Error(
          `Seat limit reached (${billing.seat_limit}). Upgrade seats on the Design & Build License.`,
        );
        (err as Error & { code?: string }).code = "SEAT_LIMIT";
        throw err;
      }

      const member: import("./types").WorkspaceMember = {
        workspace_id: workspaceId,
        user_id: userId,
        role,
        joined_at: new Date().toISOString(),
      };
      _workspaceMembers.push(member);
      flush();
      return { member: { ...member }, created: true };
    },

    async removeWorkspaceMember(workspaceId, userId) {
      const idx = _workspaceMembers.findIndex(
        (m) => m.workspace_id === workspaceId && m.user_id === userId,
      );
      if (idx < 0) return false;
      const row = _workspaceMembers[idx]!;
      if (row.role === "owner") return false;
      _workspaceMembers.splice(idx, 1);
      flush();
      return true;
    },

    async appendIntegrationEvent(ownerId, input) {
      const row: import("./types").IntegrationEvent = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        created_at: new Date().toISOString(),
        ...input,
      };
      _integrationEvents.push(row);
      flush();
      return { ...row };
    },

    async listIntegrationEvents(ownerId, limit = 50) {
      return _integrationEvents
        .filter((e) => e.owner_id === ownerId)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, limit)
        .map((e) => ({ ...e }));
    },

    async listProjectFiles(ownerId, projectId) {
      return _projectFiles
        .filter((f) => f.owner_id === ownerId && f.project_id === projectId)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .map((f) => ({ ...f }));
    },

    async createProjectFile(ownerId, projectId, input) {
      const project = _projects.find(
        (x) => x.id === projectId && x.owner_id === ownerId,
      );
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }
      const row: import("./types").ProjectFile = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        project_id: projectId,
        created_at: new Date().toISOString(),
        ...input,
      };
      _projectFiles.push(row);
      flush();
      return { ...row };
    },

    async deleteProjectFile(ownerId, projectId, fileId) {
      const idx = _projectFiles.findIndex(
        (f) =>
          f.id === fileId &&
          f.project_id === projectId &&
          f.owner_id === ownerId,
      );
      if (idx < 0) return false;
      const row = _projectFiles[idx]!;
      logActivity(
        ownerId,
        projectId,
        "project_file.deleted",
        `File "${row.title}" (${row.kind}) removed`,
        fileId,
      );
      _projectFiles.splice(idx, 1);
      flush();
      return true;
    },

    async listActivityEvents(ownerId, projectId) {
      return _activityEvents
        .filter(
          (e) =>
            e.owner_id === ownerId &&
            e.project_id === projectId,
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    },

    async listWorkspaceActivityEvents(ownerId) {
      return _activityEvents
        .filter((e) => e.owner_id === ownerId && e.project_id === null)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    },

    async getOrchestrationOverlayRecord(ownerId, projectId) {
      const row = _orchestrationOverlays.find(
        (r) => r.owner_id === ownerId && r.project_id === projectId,
      );
      return row ? structuredClone(row) : null;
    },

    async upsertOrchestrationOverlayRecord(ownerId, projectId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const now = new Date().toISOString();
      const existing = _orchestrationOverlays.find(
        (r) => r.owner_id === ownerId && r.project_id === projectId,
      );
      if (existing) {
        existing.dismissed_ids = [...input.dismissed_ids];
        existing.accepted_ids = [...input.accepted_ids];
        existing.updated_at = now;
        flush();
        return structuredClone(existing);
      }
      const row: import("@workstream/contracts").OrchestrationOverlayRecord = {
        owner_id: ownerId,
        project_id: projectId,
        dismissed_ids: [...input.dismissed_ids],
        accepted_ids: [...input.accepted_ids],
        updated_at: now,
      };
      _orchestrationOverlays.push(row);
      flush();
      return structuredClone(row);
    },

    async listDesignBranches(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return [];
      return _designBranches
        .filter((b) => b.project_id === projectId)
        .map((b) => structuredClone(b))
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    },

    async freezeDesignBranch(ownerId, projectId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);
      for (const b of _designBranches) {
        if (b.project_id === projectId) b.active = false;
      }
      const {
        canvasSnapshotFromDesignCanvas,
        createFrozenBranch,
      } = await import("@workstream/domain");
      let canvas = input.canvas;
      if (!canvas) {
        const current = _designCanvases.find((c) => c.project_id === projectId);
        if (current) {
          canvas = canvasSnapshotFromDesignCanvas(current);
        }
      }
      const branch = createFrozenBranch({
        projectId,
        input: { ...input, canvas },
      });
      _designBranches.push(branch);
      flush();
      return structuredClone(branch);
    },

    async activateDesignBranch(ownerId, projectId, branchId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return null;
      const target = _designBranches.find(
        (b) => b.project_id === projectId && b.id === branchId,
      );
      if (!target) return null;
      for (const b of _designBranches) {
        if (b.project_id === projectId) b.active = b.id === branchId;
      }
      if (target.canvas) {
        await this.upsertDesignCanvas(ownerId, projectId, {
          placements: target.canvas.placements,
          strokes: target.canvas.strokes,
          irrigation_zones: target.canvas.irrigation_zones,
          annotations: target.canvas.annotations,
          features: target.canvas.features,
        });
      }
      flush();
      return structuredClone(target);
    },

    async listLeftovers(ownerId) {
      return _leftovers
        .filter((l) => l.owner_id === ownerId)
        .map((l) => structuredClone(l))
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    },

    async registerLeftover(ownerId, input) {
      const { registerLeftover } = await import("@workstream/domain");
      const row = registerLeftover({
        orderQty: input.order_qty,
        usedQty: input.used_qty,
        sku: input.sku,
        label: input.label,
        unit: input.unit,
        sourceProjectId: input.source_project_id,
        ownerId,
      });
      if (!row) return null;
      _leftovers.push(row);
      flush();
      return structuredClone(row);
    },

    async getDesignCanvas(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return null;
      const canvas = _designCanvases.find((c) => c.project_id === projectId);
      if (!canvas) return null;
      return {
        ...canvas,
        irrigation_zones: canvas.irrigation_zones ?? [],
        annotations: canvas.annotations ?? [],
        features: canvas.features ?? [],
      };
    },

    async listCatalogSymbols(ownerId) {
      const { CURTIS_CATALOG_SYMBOLS } = await import("@workstream/domain");
      const custom = _catalogCustom
        .filter((s) => s.owner_id === ownerId)
        .map(({ owner_id: _o, ...sym }) => sym);
      return [...CURTIS_CATALOG_SYMBOLS, ...custom];
    },

    async createCustomCatalogSymbol(ownerId, input) {
      const { symbolFromUpload } = await import("@workstream/domain");
      const id = `custom-${crypto.randomUUID()}`;
      const sym = symbolFromUpload(id, input);
      _catalogCustom.push({ ...sym, owner_id: ownerId });
      flush();
      return sym;
    },

    async deleteCustomCatalogSymbol(ownerId, id) {
      if (!id.startsWith("custom-")) return false;
      const idx = _catalogCustom.findIndex(
        (s) => s.owner_id === ownerId && s.id === id,
      );
      if (idx < 0) return false;
      const sym = _catalogCustom[idx]!;
      logActivity(
        ownerId,
        null,
        "catalog_symbol.deleted",
        `Catalog symbol "${sym.label}" removed`,
        id,
      );
      _catalogCustom.splice(idx, 1);
      flush();
      return true;
    },

    async upsertDesignCanvas(ownerId, projectId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const now = new Date().toISOString();
      const existing = _designCanvases.find((c) => c.project_id === projectId);
      if (existing) {
        existing.placements = input.placements;
        if (input.strokes !== undefined) existing.strokes = input.strokes;
        if (input.irrigation_zones !== undefined) {
          existing.irrigation_zones = input.irrigation_zones;
        }
        if (input.annotations !== undefined) {
          existing.annotations = input.annotations;
        }
        if (input.features !== undefined) {
          existing.features = input.features;
        }
        existing.updated_at = now;
        flush();
        return { ...existing, features: existing.features ?? [] };
      }
      const canvas: import("@workstream/contracts").DesignCanvas = {
        id: crypto.randomUUID(),
        project_id: projectId,
        placements: input.placements,
        strokes: input.strokes ?? [],
        irrigation_zones: input.irrigation_zones ?? [],
        annotations: input.annotations ?? [],
        features: input.features ?? [],
        updated_at: now,
      };
      _designCanvases.push(canvas);
      flush();
      return canvas;
    },

    async getCadDocument(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return null;
      const doc = _cadDocuments.find((c) => c.project_id === projectId);
      return doc ? { ...doc, blocks: doc.blocks ?? [] } : null;
    },

    async upsertCadDocument(ownerId, projectId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const now = new Date().toISOString();
      const existing = _cadDocuments.find((c) => c.project_id === projectId);
      if (existing) {
        existing.origin = input.origin ?? existing.origin;
        existing.width_m = input.width_m;
        existing.height_m = input.height_m;
        existing.layers = input.layers;
        existing.entities = input.entities;
        if (input.blocks !== undefined) existing.blocks = input.blocks;
        if (input.ai_run_id !== undefined) existing.ai_run_id = input.ai_run_id;
        if (input.source_sketch_id !== undefined) {
          existing.source_sketch_id = input.source_sketch_id;
        }
        existing.updated_at = now;
        flush();
        return { ...existing };
      }
      const doc: import("@workstream/contracts").CadDocument = {
        id: crypto.randomUUID(),
        project_id: projectId,
        version: 1,
        units: "m",
        origin: input.origin ?? { x: 0, y: 0 },
        width_m: input.width_m,
        height_m: input.height_m,
        layers: input.layers,
        entities: input.entities,
        blocks: input.blocks ?? [],
        ai_run_id: input.ai_run_id ?? null,
        source_sketch_id: input.source_sketch_id ?? null,
        updated_at: now,
      };
      _cadDocuments.push(doc);
      flush();
      return doc;
    },

    async getOrchestrationOverlayState(ownerId, projectId) {
      const row = _orchestrationOverlays.find(
        (r) => r.owner_id === ownerId && r.project_id === projectId,
      );
      if (!row) return { accepted: [], dismissed: [] };
      return {
        accepted: [...row.accepted_ids],
        dismissed: [...row.dismissed_ids],
      };
    },

    async setOrchestrationOverlayState(ownerId, projectId, state) {
      const accepted = [...new Set(state.accepted)];
      const dismissed = [...new Set(state.dismissed)];
      await this.upsertOrchestrationOverlayRecord(ownerId, projectId, {
        accepted_ids: accepted,
        dismissed_ids: dismissed,
      });
      return { accepted, dismissed };
    },

    async getSiteBoundary(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return null;
      const doc = _siteBoundaries.find((b) => b.project_id === projectId);
      return doc ? structuredClone(doc) : null;
    },

    async upsertSiteBoundary(ownerId, projectId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const now = new Date().toISOString();
      const existing = _siteBoundaries.find((b) => b.project_id === projectId);
      if (existing) {
        existing.layer_id = input.layer_id ?? existing.layer_id;
        existing.status = input.status;
        existing.last_modified_by =
          input.last_modified_by !== undefined
            ? input.last_modified_by
            : existing.last_modified_by;
        existing.source_kind = input.source_kind ?? existing.source_kind;
        existing.geo_reference = input.geo_reference;
        existing.width_m = input.width_m;
        existing.height_m = input.height_m;
        existing.calculated_metrics = input.calculated_metrics;
        existing.vertices = input.vertices;
        existing.updated_at = now;
        flush();
        return structuredClone(existing);
      }
      const doc: import("@workstream/contracts").SiteBoundary = {
        id: crypto.randomUUID(),
        project_id: projectId,
        layer_id: input.layer_id ?? "layer_baseline_boundary",
        status: input.status,
        last_modified_by: input.last_modified_by ?? null,
        source_kind: input.source_kind ?? "manual",
        geo_reference: input.geo_reference,
        width_m: input.width_m,
        height_m: input.height_m,
        calculated_metrics: input.calculated_metrics,
        vertices: input.vertices,
        updated_at: now,
      };
      _siteBoundaries.push(doc);
      flush();
      return structuredClone(doc);
    },

    async deleteSiteBoundary(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return false;
      const idx = _siteBoundaries.findIndex((b) => b.project_id === projectId);
      if (idx < 0) return false;
      _siteBoundaries.splice(idx, 1);
      flush();
      return true;
    },

    async deleteCrewMember(ownerId, id) {
      const idx = _crew.findIndex(
        (c) => c.id === id && c.owner_id === ownerId,
      );
      if (idx < 0) return false;
      const member = _crew[idx]!;
      logActivity(
        ownerId,
        null,
        "crew_member.deleted",
        `Crew member "${member.name}" removed`,
        id,
      );
      _crew.splice(idx, 1);
      flush();
      return true;
    },

    async upsertProjectMyobLink(ownerId, projectId, patch) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const existing = _projectMyobLinks.find(
        (l) => l.project_id === projectId,
      );
      const now = new Date().toISOString();
      if (existing) {
        if (patch.myob_customer_uid != null)
          existing.myob_customer_uid = patch.myob_customer_uid;
        if (patch.myob_job_number !== undefined)
          existing.myob_job_number = patch.myob_job_number;
        if (patch.invoice_uid !== undefined)
          existing.invoice_uid = patch.invoice_uid;
        existing.last_synced_at = now;
        flush();
        return existing;
      }
      if (!patch.myob_customer_uid) {
        throw new Error("myob_customer_uid required for first link");
      }
      const link: ProjectMyobLink = {
        project_id: projectId,
        myob_customer_uid: patch.myob_customer_uid,
        myob_job_number: patch.myob_job_number ?? null,
        invoice_uid: patch.invoice_uid ?? null,
        last_synced_at: now,
      };
      _projectMyobLinks.push(link);
      flush();
      return link;
    },
  };
}
