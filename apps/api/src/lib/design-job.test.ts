import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@workstream/db";
import { runSurvey } from "./survey-job";
import { runDesign } from "./design-job";

describe("runDesign", { timeout: 20000 }, () => {
  let store: ReturnType<typeof createMemoryStore>;
  const owner = "design-test";

  beforeEach(async () => {
    store = createMemoryStore();
    await store.seedDefaults();
  });

  it("requires survey before design", async () => {
    const project = await store.createProject(owner, {
      address: "2 Test St, Carlton VIC 3053",
    });
    await expect(runDesign(store, owner, project.id)).rejects.toThrow(
      /Survey is required/,
    );
  });

  it("returns tier-1 zones for Wrights Terrace without Claude", async () => {
    const project = await store.createProject(owner, {
      address: "36 Wrights Terrace, Prahran VIC 3181",
      lat: -37.85,
      lng: 145.0,
    });
    await runSurvey(store, owner, project.id);
    const design = await runDesign(store, owner, project.id);

    expect(design.proposal.zones.length).toBeGreaterThanOrEqual(2);
    expect(design.proposal.zones.some((z) => z.name.includes("Front"))).toBe(
      true,
    );
    expect(design.rationale).toMatch(/Tier-1|Wrights|proposal/i);
  });
});
