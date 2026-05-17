import type {
  CreateProjectInput,
  PlantPalette,
  Project,
  ProjectStatus,
  RateCard,
  Recording,
  Survey,
} from "@walkthrough/contracts";

export type {
  CreateProjectInput,
  PlantPalette,
  Project,
  ProjectStatus,
  RateCard,
  Recording,
  Survey,
};

export type SurveyInput = Omit<Survey, "id" | "project_id">;

export interface Store {
  listProjects(ownerId: string): Promise<Project[]>;
  createProject(ownerId: string, input: CreateProjectInput): Promise<Project>;
  getProject(ownerId: string, id: string): Promise<Project | null>;
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
  listPlantPalette(ownerId: string): Promise<PlantPalette[]>;
  upsertSurvey(
    ownerId: string,
    projectId: string,
    input: SurveyInput,
  ): Promise<Survey>;
  getSurvey(ownerId: string, projectId: string): Promise<Survey | null>;
  seedDefaults(): Promise<void>;
}
