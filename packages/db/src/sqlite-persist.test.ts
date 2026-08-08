import { describe, expect, it } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  existsSync,
  rmSync,
  readdirSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createMemoryStore } from "./memory";
import {
  assertSqliteDirWritable,
  openSqliteJournal,
  recordIdFor,
} from "./sqlite-persist";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "ws-sqlite-"));
}

describe("sqlite-persist", () => {
  it("recordIdFor prefers id, then known composites", () => {
    expect(recordIdFor("_projects", { id: "p1" })).toBe("p1");
    expect(
      recordIdFor("_integrations", { owner_id: "o", key: "stripe" }),
    ).toBe("o:stripe");
    expect(recordIdFor("_workspaceBilling", { owner_id: "o" })).toBe("o");
  });

  it("write-through survives reopen (simulated process restart)", () => {
    const dir = tempDir();
    const dbPath = join(dir, "store.sqlite3");

    const store1 = createMemoryStore({ sqlitePath: dbPath });
    store1._loadSnapshot();
    store1._projects.push({
      id: "proj-restart",
      owner_id: "owner-a",
      address: "Restart Rd",
      lat: null,
      lng: null,
      created_at: new Date().toISOString(),
      status: "draft",
      client_name: null,
      client_email: null,
      crm_stage: "enquiry",
      crm_synced_at: null,
      deleted_at: null,
    });
    store1._sqlite!.flush();
    store1._sqlite!.close();

    const store2 = createMemoryStore({ sqlitePath: dbPath });
    expect(store2._loadSnapshot()).toBe(true);
    expect(store2._projects.some((p) => p.id === "proj-restart")).toBe(true);
    expect(store2._projects.find((p) => p.id === "proj-restart")?.address).toBe(
      "Restart Rd",
    );
    store2._sqlite?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("first-boot imports JSON snapshot then archives it", () => {
    const dir = tempDir();
    const dbPath = join(dir, "store.sqlite3");
    const jsonPath = join(dir, "store.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        _projects: [
          {
            id: "from-json",
            owner_id: "o1",
            address: "JSON Ave",
            lat: null,
            lng: null,
            created_at: new Date().toISOString(),
            status: "draft",
            client_name: null,
            client_email: null,
            crm_stage: "enquiry",
            crm_synced_at: null,
            deleted_at: null,
          },
        ],
        _rateCard: [],
        _plantPalette: [],
      }),
      "utf8",
    );

    const store = createMemoryStore({
      sqlitePath: dbPath,
      persistPath: jsonPath,
    });
    store._loadSnapshot();
    expect(store._projects.some((p) => p.id === "from-json")).toBe(true);
    expect(existsSync(jsonPath)).toBe(false);
    expect(
      readdirSync(dir).some((f) => f.startsWith("store.json.imported-")),
    ).toBe(true);
    store._sqlite?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("unwritable path throws in production", () => {
    const dir = tempDir();
    const fileAsDir = join(dir, "not-a-dir");
    writeFileSync(fileAsDir, "x");
    expect(() =>
      assertSqliteDirWritable(join(fileAsDir, "store.sqlite3"), {
        production: true,
      }),
    ).toThrow(/not writable/i);
    rmSync(dir, { recursive: true, force: true });
  });

  it("probeWritable returns true on a live journal", () => {
    const dir = tempDir();
    const journal = openSqliteJournal(join(dir, "p.sqlite3"));
    const arrays = { _projects: [] as unknown[] };
    journal.loadInto(arrays);
    expect(journal.probeWritable()).toBe(true);
    journal.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
