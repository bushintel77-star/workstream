import path from "path";
import { createMemoryStore } from "./memory";
import type { Store } from "./types";

function resolvePersistPath(): string {
  return (
    process.env.WORKSTREAM_PERSIST_PATH ??
    process.env.CONSTRUCT_PERSIST_PATH ??
    path.join(process.cwd(), "data", "store.json")
  );
}

export type {
  Store,
  CreateProjectInput,
  Project,
  RateCard,
  PlantPalette,
  Survey,
  SurveyInput,
  Design,
  DesignInput,
  Costing,
  CostingInput,
  Audit,
  AuditInput,
  Output,
  OutputKind,
  OutputInput,
  Override,
  CreateOverrideInput,
  Task,
  TaskStatus,
  CreateTaskInput,
  SkuLink,
  UpsertSkuLinkInput,
  ProjectMyobLink,
  CrewMember,
  CreateCrewMemberInput,
  UpdateCrewMemberInput,
  PhotoMeasurement,
  PhotoMeasurementInput,
  OrchestrationOverlayState,
} from "./types";
export { SYSTEM_OWNER, createMemoryStore } from "./memory";

let store: ReturnType<typeof createMemoryStore> | null = null;

export function getStore(): Store {
  if (!store) {
    store = createMemoryStore({ persistPath: resolvePersistPath() });
  }
  return store;
}

export async function initStore(): Promise<Store> {
  if (!store) {
    store = createMemoryStore({ persistPath: resolvePersistPath() });
  }
  store._loadSnapshot();
  await store.seedDefaults();
  return store;
}
