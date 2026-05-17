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
} from "./types";
export { SYSTEM_OWNER } from "./memory";

let store: Store | null = null;

export function getStore(): Store {
  if (!store) {
    store = createMemoryStore();
  }
  return store;
}

export async function initStore(): Promise<Store> {
  const s = getStore();
  await s.seedDefaults();
  return s;
}
