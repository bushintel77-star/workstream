import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@workstream/db";
import { runSurvey } from "./survey-job";
import { runDesign } from "./design-job";
import { runCosting } from "./cost-job";
import { runProjectAudit } from "./audit-job";

describe("runProjectAudit", { timeout: 20000 }, () => {
  let store: ReturnType<typeof createMemoryStore>;
  const owner = "audit-test";

  beforeEach(async () => {
    store = createMemoryStore();
    await store.seedDefaults();
  });

  it("requires costing before audit", async () => {
    const project = await store.createProject(owner, {
      address: "5 Test St, Carlton VIC 3053",
    });
    await runSurvey(store, owner, project.id);
    await runDesign(store, owner, project.id);
    await expect(runProjectAudit(store, owner, project.id)).rejects.toThrow(
      /Costing is required/,
    );
  });

  it("persists audit findings after full prerequisites", async () => {
    const project = await store.createProject(owner, {
      address: "6 Test St, Carlton VIC 3053",
    });
    await runSurvey(store, owner, project.id);
    await runDesign(store, owner, project.id);
    await runCosting(store, owner, project.id);

    const audit = await runProjectAudit(store, owner, project.id);

    expect(Array.isArray(audit.findings)).toBe(true);
    expect(audit.blocking_count).toBeGreaterThanOrEqual(0);
    expect(typeof audit.passed).toBe("boolean");

    const updated = await store.getProject(owner, project.id);
    expect(updated?.status).toBe("audit");
  });
});
