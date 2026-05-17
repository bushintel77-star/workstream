import type {
  Audit,
  Costing,
  CreateProjectInput,
  Design,
  Output,
  Override,
  PlantPalette,
  Project,
  ProjectStatus,
  RateCard,
  Recording,
  Survey,
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
  };
}
