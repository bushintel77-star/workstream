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
  StageLog,
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
  ProjectSignoff,
  UpsertProjectSignoffInput,
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
  TelemetryReading,
  PresentationDocument,
  CreatePresentationDocumentInput,
  UpdatePresentationDocumentInput,
  OperatorPlantProfile,
  OperatorPlantProfileInput,
  DesignBranch,
  DesignRevision,
  CreateDesignBranchInput,
  CommitDesignBranchInput,
  MergeDesignBranchInput,
  DocumentationPackage,
  CreateDocumentationPackageInput,
  IssueDocumentationPackageInput,
  LeftoverStock,
  RegisterLeftoverInput,
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
  StageLog,
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
  ProjectSignoff,
  UpsertProjectSignoffInput,
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
  TelemetryReading,
  PresentationDocument,
  CreatePresentationDocumentInput,
  UpdatePresentationDocumentInput,
  OperatorPlantProfile,
  OperatorPlantProfileInput,
  DesignBranch,
  DesignRevision,
  CreateDesignBranchInput,
  CommitDesignBranchInput,
  MergeDesignBranchInput,
  DocumentationPackage,
  CreateDocumentationPackageInput,
  IssueDocumentationPackageInput,
};

export type TelemetryReadingInput = Omit<
  TelemetryReading,
  "id" | "created_at" | "project_id"
>;

/** Durable record of a Stripe webhook delivery (idempotency + audit). */
export type StripeEventRecord = {
  event_id: string;
  status: "processing" | "done" | "failed";
  payload: string;
  created_at: string;
  updated_at: string;
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
  appendStageLog(
    ownerId: string,
    projectId: string,
    log: StageLog,
    currentStage?: string | null,
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
    durationS: number,
    dilConsent?: boolean,
  ): Promise<Recording | null>;
  updateRecordingTranscript(
    recordingId: string,
    transcript: string,
    confidence: number
  ): Promise<Recording | null>;
  /** Persist the final public audio URI once the file is on disk. */
  updateRecordingAudioUri(
    recordingId: string,
    uri: string
  ): Promise<Recording | null>;
  /** Remove a recording row when its audio file could not be persisted. */
  deleteRecording(ownerId: string, recordingId: string): Promise<boolean>;
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
  createTelemetryReading(
    ownerId: string,
    projectId: string,
    input: TelemetryReadingInput,
  ): Promise<TelemetryReading>;
  listTelemetryReadings(
    ownerId: string,
    projectId: string,
  ): Promise<TelemetryReading[]>;
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
  /** Resolve which workspace a user belongs to (owner or invited operator). */
  findWorkspaceByUser(userId: string): Promise<WorkspaceMember | null>;
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
    opts?: { branchId?: string },
  ): Promise<DesignCanvas | null>;
  upsertDesignCanvas(
    ownerId: string,
    projectId: string,
    input: UpsertDesignCanvasInput,
    opts?: { branchId?: string },
  ): Promise<DesignCanvas>;
  listDesignBranches(
    ownerId: string,
    projectId: string,
  ): Promise<DesignBranch[]>;
  getDesignBranch(
    ownerId: string,
    projectId: string,
    branchId: string,
  ): Promise<DesignBranch | null>;
  createDesignBranch(
    ownerId: string,
    projectId: string,
    input: CreateDesignBranchInput,
    authorId: string,
  ): Promise<{ branch: DesignBranch; revision: DesignRevision }>;
  commitDesignBranch(
    ownerId: string,
    projectId: string,
    branchId: string,
    input: CommitDesignBranchInput,
    authorId: string,
  ): Promise<DesignRevision>;
  abandonDesignBranch(
    ownerId: string,
    projectId: string,
    branchId: string,
  ): Promise<DesignBranch | null>;
  getDesignRevision(
    ownerId: string,
    projectId: string,
    revisionId: string,
  ): Promise<DesignRevision | null>;
  diffDesignBranches(
    ownerId: string,
    projectId: string,
    leftBranchId: string,
    rightBranchId: string,
  ): Promise<{
    left: DesignCanvas | null;
    right: DesignCanvas | null;
    base: DesignCanvas | null;
  }>;
  mergeDesignBranch(
    ownerId: string,
    projectId: string,
    sourceBranchId: string,
    input: MergeDesignBranchInput,
    authorId: string,
  ): Promise<
    | { ok: true; branch: DesignBranch; revision: DesignRevision; canvas: DesignCanvas }
    | {
      ok: false;
      conflicts: Array<{ kind: string; id: string; label: string }>;
    }
  >;
  listDocumentationPackages(
    ownerId: string,
    projectId: string,
  ): Promise<DocumentationPackage[]>;
  getDocumentationPackage(
    ownerId: string,
    projectId: string,
    packId: string,
  ): Promise<DocumentationPackage | null>;
  createDocumentationPackage(
    ownerId: string,
    projectId: string,
    input: CreateDocumentationPackageInput & {
      schedules: DocumentationPackage["schedules"];
    },
  ): Promise<DocumentationPackage>;
  issueDocumentationPackage(
    ownerId: string,
    projectId: string,
    packId: string,
    input: IssueDocumentationPackageInput,
  ): Promise<DocumentationPackage | null>;
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
  getSignoff(
    ownerId: string,
    projectId: string,
  ): Promise<ProjectSignoff | null>;
  upsertSignoff(
    ownerId: string,
    projectId: string,
    input: UpsertProjectSignoffInput,
  ): Promise<ProjectSignoff>;
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
  /**
   * Persistent claim for a Stripe webhook event. Returns "done" when the
   * event was already processed successfully (safe to skip); "new" or
   * "retry" both mean the caller should process ("retry" = a previous
   * attempt crashed or failed).
   */
  beginStripeEvent(
    eventId: string,
    payload: string
  ): Promise<"new" | "done" | "retry">;
  finishStripeEvent(
    eventId: string,
    status: "done" | "failed"
  ): Promise<void>;
  listPresentationDocuments(
    ownerId: string,
    projectId: string,
  ): Promise<PresentationDocument[]>;
  getPresentationDocument(
    ownerId: string,
    projectId: string,
    docId: string,
  ): Promise<PresentationDocument | null>;
  createPresentationDocument(
    ownerId: string,
    projectId: string,
    input: CreatePresentationDocumentInput,
  ): Promise<PresentationDocument>;
  updatePresentationDocument(
    ownerId: string,
    projectId: string,
    docId: string,
    input: UpdatePresentationDocumentInput,
  ): Promise<PresentationDocument | null>;
  deletePresentationDocument(
    ownerId: string,
    projectId: string,
    docId: string,
  ): Promise<boolean>;
  getOperatorPlantProfile(ownerId: string): Promise<OperatorPlantProfile | null>;
  upsertOperatorPlantProfile(
    ownerId: string,
    input: OperatorPlantProfileInput,
  ): Promise<OperatorPlantProfile>;
  listLeftovers(ownerId: string): Promise<LeftoverStock[]>;
  registerLeftover(
    ownerId: string,
    input: RegisterLeftoverInput,
  ): Promise<LeftoverStock | null>;
  seedDefaults(): Promise<void>;
}

export interface IntegrationSecret {
  owner_id: string;
  key: string;
  value: string;
  updated_at: string;
}
