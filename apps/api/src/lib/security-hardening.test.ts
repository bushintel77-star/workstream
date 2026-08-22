import { afterEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@workstream/db";
import { isAuthRequired } from "./auth-config";
import { getOwnerEnv, bindOwnerSecrets, runWithOwnerSecrets } from "./owner-secrets";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("isAuthRequired — production fail-closed", () => {
  it("refuses the dev-user bypass in production even with AUTH_REQUIRED=false", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_REQUIRED = "false";
    expect(isAuthRequired()).toBe(true);
  });

  it("requires auth by default in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_REQUIRED;
    expect(isAuthRequired()).toBe(true);
  });

  it("honors the explicit flag outside production", () => {
    process.env.NODE_ENV = "development";
    process.env.AUTH_REQUIRED = "true";
    expect(isAuthRequired()).toBe(true);
    process.env.AUTH_REQUIRED = "false";
    expect(isAuthRequired()).toBe(false);
  });
});

describe("getOwnerEnv — owner-scoped with local-only fallback", () => {
  it("reads the bound owner map", async () => {
    const store = createMemoryStore();
    await store.patchWorkspaceBilling("owner_a", { plan: "studio" });
    await store.setIntegration("owner_a", "MYOB_ACCESS_TOKEN", "secret-a");
    await bindOwnerSecrets(store, "owner_a");
    expect(getOwnerEnv("MYOB_ACCESS_TOKEN")).toBe("secret-a");
  });

  it("never falls back to process.env in production (cross-tenant leak)", () => {
    process.env.NODE_ENV = "production";
    process.env.TWILIO_AUTH_TOKEN = "deploy-wide-secret";
    expect(getOwnerEnv("TWILIO_AUTH_TOKEN")).toBeUndefined();
  });

  it("falls back to process.env outside production for local demos", () => {
    process.env.NODE_ENV = "development";
    process.env.TWILIO_AUTH_TOKEN = "deploy-wide-secret";
    expect(getOwnerEnv("TWILIO_AUTH_TOKEN")).toBe("deploy-wide-secret");
  });

  it("isolates two owners from each other", async () => {
    const store = createMemoryStore();
    await store.patchWorkspaceBilling("owner_a", { plan: "studio" });
    await store.patchWorkspaceBilling("owner_b", { plan: "studio" });
    await store.setIntegration("owner_a", "OPENAI_API_KEY", "key-a");
    await store.setIntegration("owner_b", "OPENAI_API_KEY", "key-b");
    // Each owner runs in its own scoped context, like a request or a queue job.
    await runWithOwnerSecrets(store, "owner_a", async () => {
      expect(getOwnerEnv("OPENAI_API_KEY")).toBe("key-a");
    });
    await runWithOwnerSecrets(store, "owner_b", async () => {
      expect(getOwnerEnv("OPENAI_API_KEY")).toBe("key-b");
    });
    // The previous context must not leak outside the scope.
    expect(getOwnerEnv("OPENAI_API_KEY")).toBeUndefined();
  });
});

describe("workspace membership resolution", () => {
  it("resolves a user to their invited workspace with role", async () => {
    const store = createMemoryStore();
    await store.patchWorkspaceBilling("ws-owner", { seat_limit: 2 });
    await store.ensureWorkspaceMember("ws-owner", "ws-owner", "owner");
    await store.ensureWorkspaceMember("ws-owner", "operator-one", "operator");

    const member = await store.findWorkspaceByUser("operator-one");
    expect(member).toMatchObject({
      workspace_id: "ws-owner",
      user_id: "operator-one",
      role: "operator",
    });
    // The operator resolves to the workspace owner's data scope, not their own id.
    expect(member?.workspace_id).toBe("ws-owner");
  });

  it("returns null for a user with no membership", async () => {
    const store = createMemoryStore();
    expect(await store.findWorkspaceByUser("nobody")).toBeNull();
  });
});

describe("durable Stripe webhook claims", () => {
  it("dedupes a completed event across store instances (restart-safe)", async () => {
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "ws-stripe-"));
    const dbPath = join(dir, "store.sqlite3");

    const store = createMemoryStore({ sqlitePath: dbPath });
    expect(await store.beginStripeEvent("evt_1", "{}")).toBe("new");
    await store.finishStripeEvent("evt_1", "done");
    store._sqlite!.flush();
    store._sqlite!.close();

    // A fresh store (simulating a restart) still knows the event is done.
    const store2 = createMemoryStore({ sqlitePath: dbPath });
    expect(await store2.beginStripeEvent("evt_1", "{}")).toBe("done");
    store2._sqlite?.close();
  });

  it("reprocesses an event that crashed before finishing", async () => {
    const store = createMemoryStore();
    expect(await store.beginStripeEvent("evt_crash", "{}")).toBe("new");
    // Crash: no finishStripeEvent call. Next delivery must reprocess, not skip.
    expect(await store.beginStripeEvent("evt_crash", "{}")).toBe("retry");
  });

  it("records a failed delivery as retryable and done only after success", async () => {
    const store = createMemoryStore();
    await store.beginStripeEvent("evt_2", "{}");
    await store.finishStripeEvent("evt_2", "failed");
    expect(await store.beginStripeEvent("evt_2", "{}")).toBe("retry");
    await store.finishStripeEvent("evt_2", "done");
    expect(await store.beginStripeEvent("evt_2", "{}")).toBe("done");
  });
});

describe("share links die with the project", () => {
  it("refuses a decision once the project is tombstoned", async () => {
    const store = createMemoryStore();
    const project = await store.createProject("dev-user", {
      address: "Tombstone Share St, Carlton VIC 3053",
    });
    const rev = await store.createShareRevision("dev-user", project.id, {
      canvas: null,
      quoteLines: [
        { id: "l1", label: "Planting", unit: "ea", qty: 1, total: 100 },
      ],
      totalInclGst: 110,
      address: project.address,
    });
    expect(rev).not.toBeNull();
    if (!rev) throw new Error("Expected share revision");

    expect(
      (
        await store.recordShareDecision(rev.token, {
          kind: "accepted",
          clientName: "Casey Client",
        })
      ).ok,
    ).toBe(true);

    const second = await store.createShareRevision("dev-user", project.id, {
      canvas: null,
      quoteLines: [
        { id: "l1", label: "Planting", unit: "ea", qty: 1, total: 100 },
      ],
      totalInclGst: 110,
      address: project.address,
    });
    expect(second).not.toBeNull();
    if (!second) throw new Error("Expected second share revision");

    await store.deleteProject("dev-user", project.id);

    const decided = await store.recordShareDecision(second.token, {
      kind: "accepted",
      clientName: "Casey Client",
    });
    if (decided.ok) throw new Error("Expected decision to be refused");
    expect(decided.reason).toBe("not_found");
  });
});

describe("recording URI persistence and cleanup", () => {
  it("persists the final audio URI and allows cleanup of a failed upload", async () => {
    const store = createMemoryStore();
    const project = await store.createProject("dev-user", {
      address: "Recording URI St, Richmond VIC 3121",
    });
    const recording = await store.createRecording(
      "dev-user",
      project.id,
      "",
      60,
      true,
    );
    expect(recording).not.toBeNull();
    if (!recording) throw new Error("Expected recording");

    const updated = await store.updateRecordingAudioUri(
      recording.id,
      "https://api.example/uploads/rec.m4a",
    );
    expect(updated?.audio_uri).toBe("https://api.example/uploads/rec.m4a");
    expect((await store.getRecording(recording.id))?.audio_uri).toBe(
      "https://api.example/uploads/rec.m4a",
    );

    expect(await store.deleteRecording("dev-user", recording.id)).toBe(true);
    expect(await store.getRecording(recording.id)).toBeNull();
  });

  it("refuses to delete another workspace's recording", async () => {
    const store = createMemoryStore();
    const project = await store.createProject("owner_a", {
      address: "Recording Ownership St, South Yarra VIC 3141",
    });
    const recording = await store.createRecording(
      "owner_a",
      project.id,
      "",
      30,
      true,
    );
    expect(recording).not.toBeNull();
    if (!recording) throw new Error("Expected recording");
    expect(await store.deleteRecording("owner_b", recording.id)).toBe(false);
    expect(await store.getRecording(recording.id)).not.toBeNull();
  });
});
