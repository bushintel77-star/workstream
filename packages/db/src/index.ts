import path from "path";
import { createMemoryStore } from "./memory";
import type { Store } from "./types";

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
} from "./types";
export { SYSTEM_OWNER } from "./memory";

let store: ReturnType<typeof createMemoryStore> | null = null;

function defaultPersistPath(): string {
  return path.join(process.cwd(), "data", "store.json");
}

export function getStore(): Store {
  if (!store) {
    const persistPath =
      process.env.CONSTRUCT_PERSIST_PATH ?? defaultPersistPath();
    store = createMemoryStore({ persistPath });
  }
  return store;
}

export async function initStore(): Promise<Store> {
  if (!store) {
    const persistPath =
      process.env.CONSTRUCT_PERSIST_PATH ?? defaultPersistPath();
    store = createMemoryStore({ persistPath });
  }
  store._loadSnapshot();
  await store.seedDefaults();
  return store;
}
