import type {
  Audit,
  Costing,
  CreateProjectInput,
  CrewMember,
  Design,
  Output,
  Override,
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
  let seeded = false;

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
    if (loaded && _rateCard.length > 0 && _plantPalette.length > 0) {
      seeded = true;
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
        .filter((p) => p.owner_id === ownerId)
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
      };
      _projects.push(project);
      flush();
      return project;
    },

    async getProject(ownerId, id) {
      const p = _projects.find((x) => x.id === id && x.owner_id === ownerId);
      return p ?? null;
    },

    async deleteProject(ownerId, id) {
      const idx = _projects.findIndex(
        (x) => x.id === id && x.owner_id === ownerId,
      );
      if (idx < 0) return false;
      _projects.splice(idx, 1);

      // Cascade: gather design ids first so we can clean costings/audits
      const designIds = _designs
        .filter((d) => d.project_id === id)
        .map((d) => d.id);

      const removeWhere = <T>(arr: T[], pred: (x: T) => boolean) => {
        for (let i = arr.length - 1; i >= 0; i--) {
          if (pred(arr[i])) arr.splice(i, 1);
        }
      };

      removeWhere(_recordings, (r) => r.project_id === id);
      removeWhere(_surveys, (s) => s.project_id === id);
      removeWhere(_designs, (d) => d.project_id === id);
      removeWhere(_costings, (c) => designIds.includes(c.design_id));
      removeWhere(_audits, (a) => designIds.includes(a.design_id));
      removeWhere(_outputs, (o) => o.project_id === id);
      removeWhere(_overrides, (o) => o.project_id === id);
      removeWhere(_tasks, (t) => t.project_id === id);
      removeWhere(_projectMyobLinks, (l) => l.project_id === id);

      flush();
      return true;
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
      project.status = "processing";
      flush();
      return recording;
    },

    async updateRecordingTranscript(recordingId, transcript, confidence) {
      const r = _recordings.find((x) => x.id === recordingId);
      if (!r) return null;
      r.transcript = transcript;
      r.transcription_confidence = confidence;
      const project = _projects.find((p) => p.id === r.project_id);
      if (project) project.status = "draft";
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
        .sort((a, b) => a.construct_sku.localeCompare(b.construct_sku));
    },

    async upsertSkuLink(ownerId, input) {
      const existing = _skuLinks.find(
        (l) => l.owner_id === ownerId && l.construct_sku === input.construct_sku,
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
        construct_sku: input.construct_sku,
        myob_uid: input.myob_uid,
        myob_item_number: input.myob_item_number,
        last_synced_at: now,
      };
      _skuLinks.push(link);
      flush();
      return link;
    },

    async removeSkuLink(ownerId, construct_sku) {
      const idx = _skuLinks.findIndex(
        (l) => l.owner_id === ownerId && l.construct_sku === construct_sku,
      );
      if (idx < 0) return false;
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

    async deleteCrewMember(ownerId, id) {
      const idx = _crew.findIndex(
        (c) => c.id === id && c.owner_id === ownerId,
      );
      if (idx < 0) return false;
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
