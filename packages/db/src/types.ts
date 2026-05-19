import type {
  Audit,
  Costing,
  CreateOverrideInput,
  CreateProjectInput,
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
} from "@workstream/contracts";

export type {
  Audit,
  Costing,
  CreateOverrideInput,
  CreateProjectInput,
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
};

export type PhotoMeasurementInput = Omit<
  PhotoMeasurement,
  "id" | "created_at"
>;

export type SurveyInput = Omit<Survey, "id" | "project_id">;
export type DesignInput = Omit<Design, "id" | "project_id" | "version">;
export type CostingInput = Omit<Costing, "id" | "design_id">;
export type AuditInput = Omit<Audit, "id" | "design_id">;
export type OutputInput = Omit<Output, "id" | "project_id" | "kind">;

export interface Store {
  listProjects(ownerId: string): Promise<Project[]>;
  createProject(ownerId: string, input: CreateProjectInput): Promise<Project>;
  getProject(ownerId: string, id: string): Promise<Project | null>;
  deleteProject(ownerId: string, id: string): Promise<boolean>;
  updateProjectStatus(
    ownerId: string,
    projectId: string,
    status: ProjectStatus
  ): Promise<Project | null>;
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
  removeSkuLink(ownerId: string, construct_sku: string): Promise<boolean>;
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
  seedDefaults(): Promise<void>;
}

export interface IntegrationSecret {
  owner_id: string;
  key: string;
  value: string;
  updated_at: string;
}
