import type {
  Audit,
  Costing,
  CreateOverrideInput,
  CreateProjectInput,
  UpdateProjectClientInput,
  CrmStage,
  CreateTaskInput,
  Design,
  Output,
  OutputKind,
  Override,
  PlantPalette,
  Project,
  ProjectStatus,
  ProjectMyobLink,
  RateCard,
  Recording,
  SkuLink,
  Survey,
  Task,
  TaskStatus,
  UpsertSkuLinkInput,
  CrewMember,
  CreateCrewMemberInput,
  UpdateCrewMemberInput,
  PhotoMeasurement,
  DesignCanvas,
  UpsertDesignCanvasInput,
  CadDocument,
  UpsertCadDocumentInput,
  SiteBoundary,
  UpsertSiteBoundaryInput,
  CatalogSymbol,
  CreateCatalogSymbolInput,
  WorkspaceBilling,
  WorkspacePlan,
  WorkspaceMember,
  WorkspaceMemberRole,
  IntegrationEvent,
  IntegrationEventType,
  IntegrationChannel,
  ProjectFile,
  ProjectFileKind,
  ActivityEvent,
  ActivityAction,
  OrchestrationOverlayRecord,
  ShareRevision,
  CreateShareRevisionInput,
  ShareDecisionInput,
  ShareSnapshot,
  QuoteDoc,
  UpsertQuoteDocInput,
} from "@workstream/contracts";

export type {
  Audit,
  Costing,
  CreateOverrideInput,
  CreateProjectInput,
  UpdateProjectClientInput,
  CrmStage,
  CreateTaskInput,
  Design,
  Output,
  OutputKind,
  Override,
  PlantPalette,
  Project,
  ProjectStatus,
  ProjectMyobLink,
  RateCard,
  Recording,
  SkuLink,
  Survey,
  Task,
  TaskStatus,
  UpsertSkuLinkInput,
  CrewMember,
  CreateCrewMemberInput,
  UpdateCrewMemberInput,
  PhotoMeasurement,
  DesignCanvas,
  UpsertDesignCanvasInput,
  CadDocument,
  UpsertCadDocumentInput,
  SiteBoundary,
  UpsertSiteBoundaryInput,
  CatalogSymbol,
  CreateCatalogSymbolInput,
  WorkspaceBilling,
  WorkspacePlan,
  WorkspaceMember,
  WorkspaceMemberRole,
  IntegrationEvent,
  IntegrationEventType,
  IntegrationChannel,
  ProjectFile,
  ProjectFileKind,
  ActivityEvent,
  ActivityAction,
  OrchestrationOverlayRecord,
  ShareRevision,
  CreateShareRevisionInput,
  ShareDecisionInput,
  ShareSnapshot,
};

export type PhotoMeasurementInput = Omit<
  PhotoMeasurement,
  "id" | "created_at"
>;

/** Persisted accept/dismiss decisions for material orchestration overlays. */
export type OrchestrationOverlayState = {
  owner_id: string;
  project_id: string;
  accepted: string[];
  dismissed: string[];
};

export type SurveyInput = Omit<Survey, "id" | "project_id">;
export type DesignInput = Omit<Design, "id" | "project_id" | "version">;
export type CostingInput = Omit<Costing, "id" | "design_id">;
export type AuditInput = Omit<Audit, "id" | "design_id">;
export type OutputInput = Omit<Output, "id" | "project_id" | "kind">;

export interface Store {
  listProjects(ownerId: string): Promise<Project[]>;
  createProject(ownerId: string, input: CreateProjectInput): Promise<Project>;
  getProject(ownerId: string, id: string): Promise<Project | null>;
  resolveProjectOwner(projectId: string): Promise<string | null>;
  resolveAssetOwner(
    kind: "uploads" | "outputs" | "photos" | "aerial" | "filings",
    assetId: string,
  ): Promise<{ ownerId: string; projectId: string } | null>;
  reloadSnapshot(): void;
  deleteProject(ownerId: string, id: string): Promise<boolean>;
  restoreProject(ownerId: string, id: string): Promise<Project | null>;
  updateProjectStatus(
    ownerId: string,
    projectId: string,
    status: ProjectStatus
  ): Promise<Project | null>;
  updateProjectClient(
    ownerId: string,
    projectId: string,
    patch: UpdateProjectClientInput,
  ): Promise<Project | null>;
  touchProjectCrmSync(ownerId: string, projectId: string): Promise<Project | null>;
  listRecordings(ownerId: string, projectId: string): Promise<Recording[]>;
  createRecording(
    ownerId: string,
    projectId: string,
    audioUri: string,
    durationS: number
  ): Promise<Recording | null>;
  updateRecordingTranscript(
    recordingId: string,
    transcript: string,
    confidence: number
  ): Promise<Recording | null>;
  getRecording(recordingId: string): Promise<Recording | null>;
  listRateCard(ownerId: string): Promise<RateCard[]>;
  updateRateCardItem(
    ownerId: string,
    sku: string,
    patch: { rate?: number; notes?: string },
  ): Promise<RateCard | null>;
  listPlantPalette(ownerId: string): Promise<PlantPalette[]>;
  upsertSurvey(
    ownerId: string,
    projectId: string,
    input: SurveyInput,
  ): Promise<Survey>;
  getSurvey(ownerId: string, projectId: string): Promise<Survey | null>;
  upsertDesign(
    ownerId: string,
    projectId: string,
    input: DesignInput,
  ): Promise<Design>;
  getDesign(ownerId: string, projectId: string): Promise<Design | null>;
  upsertCosting(
    ownerId: string,
    projectId: string,
    designId: string,
    input: CostingInput,
  ): Promise<Costing>;
  listCostings(ownerId: string, projectId: string): Promise<Costing[]>;
  upsertAudit(
    ownerId: string,
    projectId: string,
    designId: string,
    input: AuditInput,
  ): Promise<Audit>;
  getAudit(ownerId: string, projectId: string): Promise<Audit | null>;
  getQuoteDoc(ownerId: string, projectId: string): Promise<QuoteDoc | null>;
  upsertQuoteDoc(
    ownerId: string,
    projectId: string,
    input: UpsertQuoteDocInput,
  ): Promise<QuoteDoc>;
  upsertOutput(
    ownerId: string,
    projectId: string,
    kind: OutputKind,
    input: OutputInput,
  ): Promise<Output>;
  listOutputs(ownerId: string, projectId: string): Promise<Output[]>;
  createOverride(
    ownerId: string,
    projectId: string,
    input: CreateOverrideInput,
  ): Promise<{ override: Override; audit: Audit }>;
  listOverrides(ownerId: string, projectId: string): Promise<Override[]>;
  createTask(
    ownerId: string,
    projectId: string,
    input: CreateTaskInput,
  ): Promise<Task>;
  listTasks(ownerId: string, projectId: string): Promise<Task[]>;
  updateTaskStatus(
    ownerId: string,
    taskId: string,
    status: TaskStatus,
  ): Promise<Task | null>;
  listSkuLinks(ownerId: string): Promise<SkuLink[]>;
  upsertSkuLink(
    ownerId: string,
    input: UpsertSkuLinkInput,
  ): Promise<SkuLink>;
  removeSkuLink(ownerId: string, rate_card_sku: string): Promise<boolean>;
  getProjectMyobLink(
    ownerId: string,
    projectId: string,
  ): Promise<ProjectMyobLink | null>;
  upsertProjectMyobLink(
    ownerId: string,
    projectId: string,
    patch: Partial<Omit<ProjectMyobLink, "project_id">>,
  ): Promise<ProjectMyobLink>;
  listCrew(ownerId: string): Promise<CrewMember[]>;
  createCrewMember(
    ownerId: string,
    input: CreateCrewMemberInput,
  ): Promise<CrewMember>;
  updateCrewMember(
    ownerId: string,
    id: string,
    patch: UpdateCrewMemberInput,
  ): Promise<CrewMember | null>;
  deleteCrewMember(ownerId: string, id: string): Promise<boolean>;
  createPhotoMeasurement(
    ownerId: string,
    projectId: string,
    input: PhotoMeasurementInput,
  ): Promise<PhotoMeasurement>;
  listPhotoMeasurements(
    ownerId: string,
    projectId: string,
  ): Promise<PhotoMeasurement[]>;
  listIntegrations(ownerId: string): Promise<IntegrationSecret[]>;
  getIntegration(
    ownerId: string,
    key: string,
  ): Promise<IntegrationSecret | null>;
  setIntegration(
    ownerId: string,
    key: string,
    value: string,
  ): Promise<IntegrationSecret>;
  deleteIntegration(ownerId: string, key: string): Promise<boolean>;
  getWorkspaceBilling(ownerId: string): Promise<WorkspaceBilling>;
  setWorkspacePlan(ownerId: string, plan: WorkspacePlan): Promise<WorkspaceBilling>;
  patchWorkspaceBilling(
    ownerId: string,
    patch: Partial<
      Pick<
        WorkspaceBilling,
        "plan" | "seat_limit" | "stripe_customer_id" | "stripe_subscription_id"
      >
    >,
  ): Promise<WorkspaceBilling>;
  listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]>;
  /**
   * Ensure user is a member. Throws / returns null path via error object
   * when seat_limit would be exceeded for a new user.
   */
  ensureWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceMemberRole,
  ): Promise<{ member: WorkspaceMember; created: boolean }>;
  removeWorkspaceMember(
    workspaceId: string,
    userId: string,
  ): Promise<boolean>;
  countWorkspaceSeats(workspaceId: string): Promise<number>;
  appendIntegrationEvent(
    ownerId: string,
    input: Omit<IntegrationEvent, "id" | "owner_id" | "created_at">,
  ): Promise<IntegrationEvent>;
  listIntegrationEvents(
    ownerId: string,
    limit?: number,
  ): Promise<IntegrationEvent[]>;
  getDesignCanvas(
    ownerId: string,
    projectId: string,
  ): Promise<DesignCanvas | null>;
  upsertDesignCanvas(
    ownerId: string,
    projectId: string,
    input: UpsertDesignCanvasInput,
  ): Promise<DesignCanvas>;
  getCadDocument(
    ownerId: string,
    projectId: string,
  ): Promise<CadDocument | null>;
  upsertCadDocument(
    ownerId: string,
    projectId: string,
    input: UpsertCadDocumentInput,
  ): Promise<CadDocument>;
  getOrchestrationOverlayState(
    ownerId: string,
    projectId: string,
  ): Promise<{ accepted: string[]; dismissed: string[] }>;
  setOrchestrationOverlayState(
    ownerId: string,
    projectId: string,
    state: { accepted: string[]; dismissed: string[] },
  ): Promise<{ accepted: string[]; dismissed: string[] }>;
  getSiteBoundary(
    ownerId: string,
    projectId: string,
  ): Promise<SiteBoundary | null>;
  upsertSiteBoundary(
    ownerId: string,
    projectId: string,
    input: UpsertSiteBoundaryInput,
  ): Promise<SiteBoundary>;
  deleteSiteBoundary(ownerId: string, projectId: string): Promise<boolean>;
  listCatalogSymbols(ownerId: string): Promise<CatalogSymbol[]>;
  createCustomCatalogSymbol(
    ownerId: string,
    input: CreateCatalogSymbolInput,
  ): Promise<CatalogSymbol>;
  deleteCustomCatalogSymbol(ownerId: string, id: string): Promise<boolean>;
  listProjectFiles(ownerId: string, projectId: string): Promise<ProjectFile[]>;
  createProjectFile(
    ownerId: string,
    projectId: string,
    input: Omit<ProjectFile, "id" | "owner_id" | "project_id" | "created_at">,
  ): Promise<ProjectFile>;
  deleteProjectFile(
    ownerId: string,
    projectId: string,
    fileId: string,
  ): Promise<boolean>;
  listActivityEvents(
    ownerId: string,
    projectId: string,
  ): Promise<ActivityEvent[]>;
  listWorkspaceActivityEvents(ownerId: string): Promise<ActivityEvent[]>;
  getOrchestrationOverlayRecord(
    ownerId: string,
    projectId: string,
  ): Promise<OrchestrationOverlayRecord | null>;
  upsertOrchestrationOverlayRecord(
    ownerId: string,
    projectId: string,
    input: Pick<OrchestrationOverlayRecord, "dismissed_ids" | "accepted_ids">,
  ): Promise<OrchestrationOverlayRecord>;
  listShareRevisions(
    ownerId: string,
    projectId: string,
  ): Promise<ShareRevision[]>;
  getShareRevisionByToken(token: string): Promise<ShareRevision | null>;
  createShareRevision(
    ownerId: string,
    projectId: string,
    snapshot: ShareSnapshot,
  ): Promise<ShareRevision | null>;
  recordShareDecision(
    token: string,
    input: ShareDecisionInput,
  ): Promise<
    | { ok: true; revision: ShareRevision }
    | { ok: false; reason: "not_found" | "superseded" | "already_decided" }
  >;
  seedDefaults(): Promise<void>;
}

export interface IntegrationSecret {
  owner_id: string;
  key: string;
  value: string;
  updated_at: string;
}
