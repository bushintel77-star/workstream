/**
 * SQLite write-through durability for the in-memory store.
 *
 * Uses Node 22 `node:sqlite` (sync DatabaseSync) — same contract as a
 * better-sqlite3 write-through journal without a native addon (Windows /
 * slim Docker stay free of a C++ toolchain).
 *
 * Runtime representation stays the in-memory arrays; this module is only
 * the durable journal underneath.
 */
import { createHash } from "crypto";
import { createRequire } from "module";
import {
  existsSync,
  mkdirSync,
  renameSync,
  accessSync,
  constants as fsConstants,
  writeFileSync,
  unlinkSync,
} from "fs";
import { dirname, join } from "path";
import { loadSnapshotInto } from "./persist";

const nodeRequire = createRequire(__filename);
const { DatabaseSync } = nodeRequire("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec: (sql: string) => void;
    prepare: (sql: string) => {
      run: (...params: unknown[]) => unknown;
      get: (...params: unknown[]) => unknown;
      all: (...params: unknown[]) => unknown[];
    };
    close: () => void;
  };
};

export type Snapshotable = Record<string, unknown[]>;

export type SqliteJournal = {
  path: string;
  flush: () => void;
  loadInto: (arrays: Snapshotable) => boolean;
  importJsonSnapshotIfEmpty: (jsonPath: string) => boolean;
  recordCount: () => number;
  probeWritable: () => boolean;
  exportSnapshot: (outPath: string) => void;
  close: () => void;
};

type RowObj = Record<string, unknown>;

/** Stable primary key for a store row (collections are heterogeneous). */
export function recordIdFor(collection: string, row: RowObj): string {
  if (typeof row.id === "string" && row.id.length > 0) return row.id;
  if (collection === "_integrations" && typeof row.key === "string") {
    return `${String(row.owner_id ?? "")}:${row.key}`;
  }
  if (collection === "_workspaceBilling" && typeof row.owner_id === "string") {
    return row.owner_id;
  }
  if (
    collection === "_workspaceMembers" &&
    typeof row.workspace_id === "string" &&
    typeof row.user_id === "string"
  ) {
    return `${row.workspace_id}:${row.user_id}`;
  }
  if (
    collection === "_projectMyobLinks" &&
    typeof row.project_id === "string"
  ) {
    return row.project_id;
  }
  if (
    (collection === "_orchestrationOverlays" ||
      collection === "_siteBoundaries") &&
    typeof row.project_id === "string"
  ) {
    const owner = typeof row.owner_id === "string" ? row.owner_id : "";
    return `${owner}:${row.project_id}`;
  }
  return createHash("sha256")
    .update(collection)
    .update(JSON.stringify(row))
    .digest("hex")
    .slice(0, 32);
}

export function ownerIdFor(row: RowObj): string {
  if (typeof row.owner_id === "string") return row.owner_id;
  if (typeof row.workspace_id === "string") return row.workspace_id;
  return "";
}

/**
 * Fail fast when the DB directory is not writable.
 * Production: throw (caller should process.exit).
 * Dev: warn only.
 */
export function assertSqliteDirWritable(
  sqlitePath: string,
  opts: { production: boolean },
): void {
  const dir = dirname(sqlitePath);
  try {
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, `.ws-write-probe-${process.pid}`);
    writeFileSync(probe, "ok", "utf8");
    unlinkSync(probe);
    accessSync(dir, fsConstants.W_OK);
  } catch (err) {
    const msg = `[db] SQLite path not writable: ${dir} (${err instanceof Error ? err.message : String(err)})`;
    if (opts.production) {
      throw new Error(msg);
    }
    console.warn(`${msg} — continuing without durability (dev only)`);
  }
}

export function openSqliteJournal(sqlitePath: string): SqliteJournal {
  const dir = dirname(sqlitePath);
  mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(sqlitePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      owner_id TEXT NOT NULL DEFAULT '',
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    );
  `);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_records_owner ON records(collection, owner_id);`,
  );

  const upsert = db.prepare(`
    INSERT INTO records (collection, id, owner_id, json, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(collection, id) DO UPDATE SET
      owner_id = excluded.owner_id,
      json = excluded.json,
      updated_at = excluded.updated_at
  `);
  const deleteAllInCollection = db.prepare(
    `DELETE FROM records WHERE collection = ?`,
  );
  const countStmt = db.prepare(`SELECT COUNT(*) AS n FROM records`);
  const loadAll = db.prepare(
    `SELECT collection, json FROM records ORDER BY collection, id`,
  );
  const deleteProbe = db.prepare(
    `DELETE FROM records WHERE collection = ? AND id = ?`,
  );

  let arraysRef: Snapshotable | null = null;

  const flush = (): void => {
    if (!arraysRef) return;
    const now = new Date().toISOString();
    db.exec("BEGIN");
    try {
      for (const [collection, rows] of Object.entries(arraysRef)) {
        deleteAllInCollection.run(collection);
        for (const raw of rows) {
          const row = raw as RowObj;
          upsert.run(
            collection,
            recordIdFor(collection, row),
            ownerIdFor(row),
            JSON.stringify(row),
            now,
          );
        }
      }
      db.exec("COMMIT");
    } catch (err) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* ignore */
      }
      /* Surface durability failures loudly — callers leave RAM ahead of disk. */
      console.error("[sqlite-persist] flush failed; in-memory state may diverge from disk", err);
      throw err;
    }
  };

  const loadInto = (arrays: Snapshotable): boolean => {
    arraysRef = arrays;
    const rows = loadAll.all() as Array<{ collection: string; json: string }>;
    if (rows.length === 0) return false;
    for (const key of Object.keys(arrays)) {
      arrays[key].length = 0;
    }
    for (const row of rows) {
      const bucket = arrays[row.collection];
      if (!bucket) continue;
      try {
        bucket.push(JSON.parse(row.json));
      } catch (err) {
        console.error(
          `[db] bad sqlite row in ${row.collection}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    return true;
  };

  const importJsonSnapshotIfEmpty = (jsonPath: string): boolean => {
    if (!arraysRef) return false;
    const n = (countStmt.get() as { n: number }).n;
    if (n > 0) return false;
    if (!existsSync(jsonPath)) return false;
    const loaded = loadSnapshotInto(jsonPath, arraysRef);
    if (!loaded) return false;
    flush();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archived = `${jsonPath}.imported-${stamp}`;
    try {
      renameSync(jsonPath, archived);
      console.info(
        `[db] imported JSON snapshot into SQLite and archived as ${archived}`,
      );
    } catch (err) {
      console.warn(
        `[db] SQLite import ok but could not archive ${jsonPath}:`,
        err instanceof Error ? err.message : err,
      );
    }
    return true;
  };

  const exportSnapshot = (outPath: string): void => {
    if (!arraysRef) {
      throw new Error("[db] exportSnapshot: journal not bound to arrays");
    }
    mkdirSync(dirname(outPath), { recursive: true });
    const snapshot: Snapshotable = {};
    for (const key of Object.keys(arraysRef)) {
      snapshot[key] = arraysRef[key];
    }
    const tmp = `${outPath}.tmp`;
    writeFileSync(tmp, JSON.stringify(snapshot, null, 2), "utf8");
    renameSync(tmp, outPath);
  };

  const probeWritable = (): boolean => {
    try {
      const probeId = `__probe_${process.pid}`;
      const now = new Date().toISOString();
      upsert.run("_probe", probeId, "", "{}", now);
      deleteProbe.run("_probe", probeId);
      return true;
    } catch {
      return false;
    }
  };

  return {
    path: sqlitePath,
    flush,
    loadInto,
    importJsonSnapshotIfEmpty,
    recordCount: () => (countStmt.get() as { n: number }).n,
    probeWritable,
    exportSnapshot,
    close: () => db.close(),
  };
}

/** Default sqlite path beside the legacy JSON snapshot. */
export function resolveSqlitePath(jsonPersistPath: string): string {
  return (
    process.env.WORKSTREAM_SQLITE_PATH ??
    process.env.CONSTRUCT_SQLITE_PATH ??
    join(dirname(jsonPersistPath), "store.sqlite3")
  );
}
