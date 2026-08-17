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
  TelemetryReading,
  OperatorPlantProfile,
} from "./types";
import type { QuoteDoc } from "@workstream/contracts";
import type { Store } from "./types";
import { mkdirSync, renameSync, writeFileSync } from "fs";
import { dirname } from "path";
import { loadSnapshotInto, makeFlusher } from "./persist";
import {
  openSqliteJournal,
  type SqliteJournal,
} from "./sqlite-persist";
import {
  commitRevision,
  createBranchFromRevision,
  ensureMainBranch,
  getBranch,
  getRevision,
  getTipCanvas,
  writeTipCanvas,
  type DesignVcsArrays,
} from "./design-vcs";
import { MAIN_DESIGN_BRANCH_NAME } from "@workstream/contracts";

export const SYSTEM_OWNER = "system";

export type CreateStoreOptions = {
  /** Legacy JSON snapshot path (export escape hatch / first-boot import). */
  persistPath?: string;
  /** SQLite write-through journal. When set, replaces JSON flush on the hot path. */
  sqlitePath?: string;
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
  _telemetryReadings: TelemetryReading[];
  _operatorPlantProfiles: OperatorPlantProfile[];
  _loadSnapshot: () => boolean;
  _sqlite?: SqliteJournal;
  _exportSnapshot: (path: string) => void;
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
  const _telemetryReadings: TelemetryReading[] = [];
  const _integrations: IntegrationSecret[] = [];
  const _workspaceBilling: import("./types").WorkspaceBilling[] = [];
  const _workspaceMembers: import("./types").WorkspaceMember[] = [];
  const _integrationEvents: import("./types").IntegrationEvent[] = [];
  const _projectFiles: import("./types").ProjectFile[] = [];
  const _designCanvases: import("@workstream/contracts").DesignCanvas[] = [];
  const _cadDocuments: import("@workstream/contracts").CadDocument[] = [];
  const _orchestrationOverlays: import("@workstream/contracts").OrchestrationOverlayRecord[] =
    [];
  const _siteBoundaries: import("@workstream/contracts").SiteBoundary[] = [];
  const _signoffs: import("@workstream/contracts").ProjectSignoff[] = [];
  const _catalogCustom: Array<
    import("@workstream/contracts").CatalogSymbol & { owner_id: string }
  > = [];
  const _activityEvents: import("./types").ActivityEvent[] = [];
  const _shareRevisions: import("./types").ShareRevision[] = [];
  const _quoteDocs: QuoteDoc[] = [];
  const _presentationDocuments: import("@workstream/contracts").PresentationDocument[] =
    [];
  const _designBranches: import("@workstream/contracts").DesignBranch[] = [];
  const _designRevisions: import("@workstream/contracts").DesignRevision[] = [];
  const _documentationPackages: import("@workstream/contracts").DocumentationPackage[] =
    [];
  const _operatorPlantProfiles: OperatorPlantProfile[] = [];
  const _leftovers: import("@workstream/contracts").LeftoverStock[] = [];
  let seeded = false;

  function vcsArrays(): DesignVcsArrays {
    return {
      branches: _designBranches,
      revisions: _designRevisions,
      canvases: _designCanvases,
    };
  }

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
    _telemetryReadings,
    _integrations,
    _workspaceBilling,
    _workspaceMembers,
    _integrationEvents,
    _projectFiles,
    _designCanvases,
    _cadDocuments,
    _orchestrationOverlays,
    _siteBoundaries,
    _signoffs,
    _catalogCustom,
    _activityEvents,
    _shareRevisions,
    _quoteDocs,
    _presentationDocuments,
    _designBranches,
    _designRevisions,
    _documentationPackages,
    _operatorPlantProfiles,
    _leftovers,
  };

  const journal: SqliteJournal | undefined = opts.sqlitePath
    ? openSqliteJournal(opts.sqlitePath)
    : undefined;

  // Bind arrays to the journal (empty DB → no-op load, arraysRef set).
  if (journal) {
    journal.loadInto(arrays as Record<string, unknown[]>);
  }

  const flush = journal
    ? () => journal.flush()
    : opts.persistPath
      ? makeFlusher(opts.persistPath, arrays as Record<string, unknown[]>)
      : () => { };

  const loadSnapshot = (): boolean => {
    if (journal) {
      const fromSqlite = journal.loadInto(arrays as Record<string, unknown[]>);
      if (!fromSqlite && opts.persistPath) {
        journal.importJsonSnapshotIfEmpty(opts.persistPath);
      }
      for (const link of _skuLinks) {
        const row = link as SkuLink & { construct_sku?: string };
        if (!row.rate_card_sku && row.construct_sku) {
          row.rate_card_sku = row.construct_sku;
        }
      }
      if (_rateCard.length > 0 && _plantPalette.length > 0) {
        seeded = true;
      }
      return fromSqlite || journal.recordCount() > 0 || _projects.length > 0;
    }
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
    _telemetryReadings,
    _operatorPlantProfiles,
    _loadSnapshot: loadSnapshot,
    _sqlite: journal,
    _exportSnapshot: (path: string) => {
      if (journal) {
        journal.exportSnapshot(path);
        return;
      }
      const snapshot: Record<string, unknown[]> = {};
      for (const [k, v] of Object.entries(arrays)) snapshot[k] = v;
      mkdirSync(dirname(path), { recursive: true });
      const tmp = `${path}.tmp`;
      writeFileSync(tmp, JSON.stringify(snapshot, null, 2), "utf8");
      renameSync(tmp, path);
    },

    async seedDefaults() {
      if (seeded) return;
      const { seedRateCard, seedPlantPalette } = await import("./seed.js");
      _rateCard.push(...seedRateCard());
      _plantPalette.push(...seedPlantPalette());
      seeded = true;
      flush();
    },

    async getOperatorPlantProfile(ownerId) {
      const row = _operatorPlantProfiles.find((p) => p.owner_id === ownerId);
      return row ? structuredClone(row) : null;
    },

    async upsertOperatorPlantProfile(ownerId, input) {
      const existing = _operatorPlantProfiles.find(
        (p) => p.owner_id === ownerId,
      );
      const now = new Date().toISOString();
      if (existing) {
        existing.machines = input.machines;
        existing.updated_at = now;
        flush();
        return structuredClone(existing);
      }
      const profile: OperatorPlantProfile = {
        owner_id: ownerId,
        machines: input.machines,
        updated_at: now,
      };
      _operatorPlantProfiles.push(profile);
      flush();
      return structuredClone(profile);
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

    async listPresentationDocuments(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return [];
      return _presentationDocuments
        .filter((d) => d.project_id === projectId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((d) => structuredClone(d));
    },

    async getPresentationDocument(ownerId, projectId, docId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return null;
      const doc = _presentationDocuments.find(
        (d) => d.id === docId && d.project_id === projectId,
      );
      return doc ? structuredClone(doc) : null;
    },

    async createPresentationDocument(ownerId, projectId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const now = new Date().toISOString();
      const doc: import("@workstream/contracts").PresentationDocument = {
        id: crypto.randomUUID(),
        project_id: projectId,
        owner_id: ownerId,
        title: input.title ?? "Untitled deck",
        deliverable_type: input.deliverable_type ?? "deck",
        template_id: input.template_id ?? "editorial_classic",
        theme: {
          palette: input.theme?.palette ?? "stone",
          highlight_colour: input.theme?.highlight_colour ?? "#b33a32",
          font: input.theme?.font ?? "fraunces",
          pen: input.theme?.pen ?? "technical",
        },
        status: "draft",
        pages: [
          {
            id: crypto.randomUUID(),
            order: 0,
            paper_size: "a3",
            orientation: "landscape",
            title_block: {
              title: "",
              subtitle: "",
              practice: "",
              revision: "",
              date_label: "",
              scale_label: "",
            },
            margins: {
              top_mm: 15,
              right_mm: 15,
              bottom_mm: 15,
              left_mm: 15,
            },
            panels: [],
          },
        ],
        created_at: now,
        updated_at: now,
        issued_at: null,
        estimate_snapshot: null,
      };
      _presentationDocuments.push(doc);
      flush();
      return structuredClone(doc);
    },

    async updatePresentationDocument(ownerId, projectId, docId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return null;
      const doc = _presentationDocuments.find(
        (d) => d.id === docId && d.project_id === projectId,
      );
      if (!doc) return null;
      const now = new Date().toISOString();
      const issuing =
        input.status === "issued" && doc.status !== "issued";
      const contentMutation =
        input.title !== undefined ||
        input.deliverable_type !== undefined ||
        input.template_id !== undefined ||
        input.theme !== undefined ||
        input.pages !== undefined;
      /* Issued decks are terminal — only the Issue transition may write
       * content (to stamp estimate_snapshot). Later edits are refused. */
      if (doc.status === "issued" && (contentMutation || input.estimate_snapshot !== undefined)) {
        const err = new Error("Deck is issued; edits are blocked");
        (err as Error & { statusCode?: number }).statusCode = 409;
        throw err;
      }
      if (input.title !== undefined) doc.title = input.title;
      if (input.deliverable_type !== undefined)
        doc.deliverable_type = input.deliverable_type;
      if (input.template_id !== undefined) doc.template_id = input.template_id;
      if (input.theme !== undefined) {
        doc.theme = {
          palette: input.theme.palette ?? doc.theme.palette,
          highlight_colour:
            input.theme.highlight_colour ?? doc.theme.highlight_colour,
          font: input.theme.font ?? doc.theme.font,
          pen: input.theme.pen ?? doc.theme.pen,
        };
      }
      if (input.status !== undefined) {
        doc.status = input.status;
        if (input.status === "issued" && !doc.issued_at) {
          doc.issued_at = now;
        }
      }
      if (input.pages !== undefined) doc.pages = input.pages;
      if (input.estimate_snapshot !== undefined) {
        doc.estimate_snapshot = input.estimate_snapshot;
      } else if (issuing && doc.estimate_snapshot == null) {
        /* Issue without a snapshot still freezes — widgets show empty honesty. */
        doc.estimate_snapshot = null;
      }
      doc.updated_at = now;
      flush();
      return structuredClone(doc);
    },

    async deletePresentationDocument(ownerId, projectId, docId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return false;
      const idx = _presentationDocuments.findIndex(
        (d) => d.id === docId && d.project_id === projectId,
      );
      if (idx < 0) return false;
      _presentationDocuments.splice(idx, 1);
      flush();
      return true;
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
        current_stage: null,
        stage_logs: [],
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
        current_stage: p.current_stage ?? null,
        stage_logs: p.stage_logs ?? [],
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

    async appendStageLog(ownerId, projectId, log, currentStage = log.stage) {
      const p = _projects.find(
        (x) => x.id === projectId && x.owner_id === ownerId,
      );
      if (!p) return null;
      p.stage_logs = [...(p.stage_logs ?? []), structuredClone(log)];
      p.current_stage = currentStage ?? null;
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

    async createRecording(ownerId, projectId, audioUri, durationS, dilConsent = false) {
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
        dil_consent: dilConsent,
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

    async getQuoteDoc(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return null;
      return _quoteDocs.find((q) => q.project_id === projectId) ?? null;
    },

    async upsertQuoteDoc(ownerId, projectId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const design = _designs.find((d) => d.project_id === projectId);
      const updated_at = new Date().toISOString();
      const existing = _quoteDocs.find((q) => q.project_id === projectId);
      if (existing) {
        Object.assign(existing, {
          ...input,
          project_id: projectId,
          design_id: input.design_id ?? design?.id ?? existing.design_id,
          updated_at,
        });
        flush();
        return existing;
      }
      const doc: QuoteDoc = {
        project_id: projectId,
        design_id: input.design_id ?? design?.id ?? null,
        overrides: input.overrides ?? [],
        custom_lines: input.custom_lines ?? [],
        margin: input.margin ?? { global_pct: 0, by_section: {} },
        updated_at,
      };
      _quoteDocs.push(doc);
      flush();
      return doc;
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

    async createTelemetryReading(ownerId, projectId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const row: TelemetryReading = {
        id: crypto.randomUUID(),
        project_id: projectId,
        ...input,
        created_at: new Date().toISOString(),
      };
      _telemetryReadings.push(row);
      flush();
      return row;
    },

    async listTelemetryReadings(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return [];
      return _telemetryReadings
        .filter((m) => m.project_id === projectId)
        .sort(
          (a, b) =>
            new Date(b.observed_at).getTime() -
            new Date(a.observed_at).getTime(),
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

    async getDesignCanvas(ownerId, projectId, opts) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return null;
      const arrays = vcsArrays();
      const main = ensureMainBranch(arrays, ownerId, projectId, ownerId);
      const branch = opts?.branchId
        ? getBranch(arrays, ownerId, projectId, opts.branchId)
        : main;
      if (!branch) return null;
      const tip = getTipCanvas(arrays, branch);
      if (!tip) return null;
      flush();
      return tip;
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

    async upsertDesignCanvas(ownerId, projectId, input, opts) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const arrays = vcsArrays();
      const main = ensureMainBranch(arrays, ownerId, projectId, ownerId);
      const branchId = opts?.branchId ?? input.branch_id;
      const branch = branchId
        ? getBranch(arrays, ownerId, projectId, branchId)
        : main;
      if (!branch) throw new Error(`Design branch not found: ${branchId}`);
      if (branch.status !== "open") {
        throw new Error(`Design branch is ${branch.status}`);
      }
      const { branch_id: _branchId, ...canvasInput } = input;
      const canvas = writeTipCanvas(arrays, branch, canvasInput);
      flush();
      return canvas;
    },

    async listDesignBranches(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return [];
      const arrays = vcsArrays();
      ensureMainBranch(arrays, ownerId, projectId, ownerId);
      flush();
      return _designBranches
        .filter((b) => b.owner_id === ownerId && b.project_id === projectId)
        .sort((a, b) => {
          if (a.name === MAIN_DESIGN_BRANCH_NAME) return -1;
          if (b.name === MAIN_DESIGN_BRANCH_NAME) return 1;
          return a.name.localeCompare(b.name, "en-AU");
        })
        .map((b) => structuredClone(b));
    },

    async getDesignBranch(ownerId, projectId, branchId) {
      const arrays = vcsArrays();
      ensureMainBranch(arrays, ownerId, projectId, ownerId);
      const branch = getBranch(arrays, ownerId, projectId, branchId);
      flush();
      return branch ? structuredClone(branch) : null;
    },

    async createDesignBranch(ownerId, projectId, input, authorId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const arrays = vcsArrays();
      const main = ensureMainBranch(arrays, ownerId, projectId, authorId);
      const name = input.name.trim();
      if (name.toLowerCase() === MAIN_DESIGN_BRANCH_NAME) {
        throw new Error("Branch name 'main' is reserved");
      }
      if (
        _designBranches.some(
          (b) =>
            b.project_id === projectId &&
            b.owner_id === ownerId &&
            b.name.toLowerCase() === name.toLowerCase() &&
            b.status === "open",
        )
      ) {
        throw new Error(`Branch already open: ${name}`);
      }
      let from = input.from_revision_id
        ? getRevision(arrays, input.from_revision_id)
        : getRevision(arrays, main.tip_revision_id);
      if (!from || from.project_id !== projectId) {
        throw new Error("from_revision_id not found");
      }
      const created = createBranchFromRevision(
        arrays,
        ownerId,
        projectId,
        name,
        from,
        authorId,
      );
      logActivity(
        ownerId,
        projectId,
        "design.branch_created",
        `Design branch "${name}" created`,
        created.branch.id,
      );
      flush();
      return {
        branch: structuredClone(created.branch),
        revision: structuredClone(created.revision),
      };
    },

    async commitDesignBranch(ownerId, projectId, branchId, input, authorId) {
      const arrays = vcsArrays();
      const branch = getBranch(arrays, ownerId, projectId, branchId);
      if (!branch) throw new Error(`Design branch not found: ${branchId}`);
      if (branch.status !== "open") {
        throw new Error(`Design branch is ${branch.status}`);
      }
      const { branch_id: _b, ...canvasInput } = input.canvas;
      const revision = commitRevision(
        arrays,
        branch,
        authorId,
        input.message ?? "Checkpoint",
        canvasInput,
      );
      flush();
      return structuredClone(revision);
    },

    async abandonDesignBranch(ownerId, projectId, branchId) {
      const arrays = vcsArrays();
      const branch = getBranch(arrays, ownerId, projectId, branchId);
      if (!branch) return null;
      if (branch.name === MAIN_DESIGN_BRANCH_NAME) {
        throw new Error("Cannot abandon main");
      }
      if (branch.status !== "open") return structuredClone(branch);
      branch.status = "abandoned";
      branch.updated_at = new Date().toISOString();
      logActivity(
        ownerId,
        projectId,
        "design.abandoned",
        `Design branch "${branch.name}" abandoned`,
        branch.id,
      );
      flush();
      return structuredClone(branch);
    },

    async getDesignRevision(ownerId, projectId, revisionId) {
      const rev = _designRevisions.find(
        (r) =>
          r.id === revisionId &&
          r.owner_id === ownerId &&
          r.project_id === projectId,
      );
      return rev ? structuredClone(rev) : null;
    },

    async diffDesignBranches(ownerId, projectId, leftBranchId, rightBranchId) {
      const arrays = vcsArrays();
      ensureMainBranch(arrays, ownerId, projectId, ownerId);
      const left = getBranch(arrays, ownerId, projectId, leftBranchId);
      const right = getBranch(arrays, ownerId, projectId, rightBranchId);
      const leftTip = left ? getTipCanvas(arrays, left) : null;
      const rightTip = right ? getTipCanvas(arrays, right) : null;
      let base: import("@workstream/contracts").DesignCanvas | null = null;
      const baseId = right?.base_revision_id ?? left?.base_revision_id;
      if (baseId) {
        const rev = getRevision(arrays, baseId);
        if (rev) base = rev.canvas;
      }
      return { left: leftTip, right: rightTip, base };
    },

    async mergeDesignBranch(ownerId, projectId, sourceBranchId, input, authorId) {
      const arrays = vcsArrays();
      const main = ensureMainBranch(arrays, ownerId, projectId, authorId);
      const source = getBranch(arrays, ownerId, projectId, sourceBranchId);
      if (!source) throw new Error("Source branch not found");
      if (source.status !== "open") {
        throw new Error(`Source branch is ${source.status}`);
      }
      const intoId = input.into_branch_id ?? main.id;
      const into = getBranch(arrays, ownerId, projectId, intoId);
      if (!into) throw new Error("Target branch not found");
      if (into.status !== "open") {
        throw new Error(`Target branch is ${into.status}`);
      }

      const baseRev = source.base_revision_id
        ? getRevision(arrays, source.base_revision_id)
        : null;
      const oursTip = getTipCanvas(arrays, into);
      const theirsTip = getTipCanvas(arrays, source);
      if (!oursTip || !theirsTip || !baseRev) {
        throw new Error("Missing merge tips or base revision");
      }

      const { mergeDesignCanvas } = await import("@workstream/domain");
      const merged = mergeDesignCanvas({
        base: baseRev.canvas,
        ours: oursTip,
        theirs: theirsTip,
        resolutions: input.resolutions ?? {},
      });
      if (!merged.ok) {
        return { ok: false as const, conflicts: merged.conflicts };
      }

      const revision = commitRevision(
        arrays,
        into,
        authorId,
        input.message ?? `Merge ${source.name}`,
        {
          placements: merged.canvas.placements,
          strokes: merged.canvas.strokes,
          irrigation_zones: merged.canvas.irrigation_zones,
          construction_trenches: merged.canvas.construction_trenches,
          annotations: merged.canvas.annotations,
          image_layers: merged.canvas.image_layers,
          features: merged.canvas.features,
          site_frame: merged.canvas.site_frame,
          presentation_pack: merged.canvas.presentation_pack,
          lifecycle_phase: merged.canvas.lifecycle_phase,
          artboard_ids: merged.canvas.artboard_ids,
        },
      );
      source.status = "merged";
      source.updated_at = new Date().toISOString();
      logActivity(
        ownerId,
        projectId,
        "design.merged",
        `Merged "${source.name}" into "${into.name}"`,
        source.id,
      );
      flush();
      return {
        ok: true as const,
        branch: structuredClone(into),
        revision: structuredClone(revision),
        canvas: structuredClone(revision.canvas),
      };
    },

    async listDocumentationPackages(ownerId, projectId) {
      return _documentationPackages
        .filter((p) => p.owner_id === ownerId && p.project_id === projectId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((p) => structuredClone(p));
    },

    async getDocumentationPackage(ownerId, projectId, packId) {
      const pack = _documentationPackages.find(
        (p) =>
          p.id === packId &&
          p.owner_id === ownerId &&
          p.project_id === projectId,
      );
      return pack ? structuredClone(pack) : null;
    },

    async createDocumentationPackage(ownerId, projectId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const now = new Date().toISOString();
      const arrays = vcsArrays();
      const main = ensureMainBranch(arrays, ownerId, projectId, ownerId);
      const pack: import("@workstream/contracts").DocumentationPackage = {
        id: crypto.randomUUID(),
        project_id: projectId,
        owner_id: ownerId,
        title: input.title ?? "Documentation pack",
        status: "draft",
        design_revision_id:
          input.design_revision_id ?? main.tip_revision_id,
        schedules: input.schedules ?? [],
        presentation_document_ids: input.presentation_document_ids ?? [],
        quote_total_incl_gst: null,
        created_at: now,
        updated_at: now,
        issued_at: null,
      };
      _documentationPackages.push(pack);
      flush();
      return structuredClone(pack);
    },

    async issueDocumentationPackage(ownerId, projectId, packId, input) {
      const pack = _documentationPackages.find(
        (p) =>
          p.id === packId &&
          p.owner_id === ownerId &&
          p.project_id === projectId,
      );
      if (!pack) return null;
      if (pack.status === "issued") {
        throw new Error("Documentation package already issued");
      }
      const now = new Date().toISOString();
      pack.status = "issued";
      pack.issued_at = now;
      pack.updated_at = now;
      if (input.quote_total_incl_gst !== undefined) {
        pack.quote_total_incl_gst = input.quote_total_incl_gst;
      }
      logActivity(
        ownerId,
        projectId,
        "documentation.issued",
        `Documentation pack "${pack.title}" issued`,
        pack.id,
      );
      flush();
      return structuredClone(pack);
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

    async getSignoff(ownerId, projectId) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) return null;
      const doc = _signoffs.find((s) => s.project_id === projectId);
      return doc ? structuredClone(doc) : null;
    },

    async upsertSignoff(ownerId, projectId, input) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId,
      );
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const now = new Date().toISOString();
      const existing = _signoffs.find((s) => s.project_id === projectId);
      if (existing) {
        existing.status = input.status;
        existing.revision = input.revision;
        existing.accepted_notice_ids = input.accepted_notice_ids;
        existing.quote_total_incl_gst = input.quote_total_incl_gst;
        existing.signed_at = input.signed_at;
        existing.signed_by = input.signed_by;
        existing.updated_at = now;
        flush();
        return structuredClone(existing);
      }
      const doc: import("@workstream/contracts").ProjectSignoff = {
        id: crypto.randomUUID(),
        project_id: projectId,
        status: input.status,
        revision: input.revision,
        accepted_notice_ids: input.accepted_notice_ids,
        quote_total_incl_gst: input.quote_total_incl_gst,
        signed_at: input.signed_at,
        signed_by: input.signed_by,
        updated_at: now,
      };
      _signoffs.push(doc);
      flush();
      return structuredClone(doc);
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

    async listShareRevisions(ownerId, projectId) {
      return _shareRevisions
        .filter(
          (r) => r.owner_id === ownerId && r.project_id === projectId,
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .map((r) => structuredClone(r));
    },

    async getShareRevisionByToken(token) {
      const row = _shareRevisions.find((r) => r.token === token);
      return row ? structuredClone(row) : null;
    },

    async createShareRevision(ownerId, projectId, snapshot) {
      const project = _projects.find(
        (p) => p.id === projectId && p.owner_id === ownerId && !p.deleted_at,
      );
      if (!project) return null;

      const { nextShareRevisionLetter } = await import("@workstream/contracts");
      const { randomBytes } = await import("node:crypto");

      const existing = _shareRevisions.filter(
        (r) => r.owner_id === ownerId && r.project_id === projectId,
      );
      for (const row of existing) {
        if (row.status === "shared") {
          row.status = "superseded";
        }
      }

      const token = randomBytes(32).toString("base64url");
      const row: import("./types").ShareRevision = {
        id: crypto.randomUUID(),
        project_id: projectId,
        owner_id: ownerId,
        revision: nextShareRevisionLetter(existing.length),
        token,
        status: "shared",
        created_at: new Date().toISOString(),
        snapshot: structuredClone(snapshot),
      };
      _shareRevisions.push(row);
      flush();
      return structuredClone(row);
    },

    async recordShareDecision(token, input) {
      const row = _shareRevisions.find((r) => r.token === token);
      if (!row) return { ok: false as const, reason: "not_found" as const };
      if (row.status === "superseded") {
        return { ok: false as const, reason: "superseded" as const };
      }
      if (row.status === "accepted" || row.status === "declined") {
        return { ok: false as const, reason: "already_decided" as const };
      }
      if (row.status !== "shared") {
        return { ok: false as const, reason: "not_found" as const };
      }

      const clientName = input.clientName.trim();
      const note = input.note?.trim();
      row.status = input.kind === "accepted" ? "accepted" : "declined";
      row.decision = {
        kind: input.kind,
        clientName,
        ...(note ? { note } : {}),
        decidedAt: new Date().toISOString(),
      };
      flush();
      return { ok: true as const, revision: structuredClone(row) };
    },
  };
}
