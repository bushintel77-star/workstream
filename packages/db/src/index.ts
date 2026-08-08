import path from "path";
import { createMemoryStore } from "./memory";
import type { Store } from "./types";
import {
  assertSqliteDirWritable,
  resolveSqlitePath,
  type SqliteJournal,
} from "./sqlite-persist";

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
  TelemetryReading,
  TelemetryReadingInput,
  OrchestrationOverlayState,
} from "./types";
export { SYSTEM_OWNER, createMemoryStore } from "./memory";
export {
  openSqliteJournal,
  resolveSqlitePath,
  assertSqliteDirWritable,
  recordIdFor,
} from "./sqlite-persist";
export { loadSnapshotInto } from "./persist";

let store: ReturnType<typeof createMemoryStore> | null = null;

function bootStore(): ReturnType<typeof createMemoryStore> {
  const jsonPath = resolvePersistPath();
  const sqlitePath = resolveSqlitePath(jsonPath);
  const production = process.env.NODE_ENV === "production";

  try {
    assertSqliteDirWritable(sqlitePath, { production });
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  try {
    return createMemoryStore({
      persistPath: jsonPath,
      sqlitePath,
    });
  } catch (err) {
    if (production) {
      console.error(
        `[db] failed to open SQLite at ${sqlitePath}:`,
        err instanceof Error ? err.message : err,
      );
      process.exit(1);
    }
    console.warn(
      `[db] SQLite unavailable — memory-only (dev).`,
      err instanceof Error ? err.message : err,
    );
    return createMemoryStore();
  }
}

export function getStore(): Store {
  if (!store) {
    store = bootStore();
  }
  return store;
}

export async function initStore(): Promise<Store> {
  if (!store) {
    store = bootStore();
  }
  store._loadSnapshot();
  await store.seedDefaults();
  return store;
}

export function getSqliteJournal(): SqliteJournal | undefined {
  return store?._sqlite;
}

export function durabilityStatus(): {
  dbPath: string | null;
  dbWritable: boolean;
  records: number;
} {
  const journal = store?._sqlite;
  if (!journal) {
    return { dbPath: null, dbWritable: false, records: 0 };
  }
  return {
    dbPath: journal.path,
    dbWritable: journal.probeWritable(),
    records: journal.recordCount(),
  };
}
