import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@workstream/db";
import { runFullPipeline } from "./pipeline-job";

describe("runFullPipeline", () => {
  let store: ReturnType<typeof createMemoryStore>;
  const owner = "pipeline-test";

  beforeEach(async () => {
    store = createMemoryStore();
    await store.seedDefaults();
  });

  it("runs survey → design → costing → audit for a generic project", async () => {
    const project = await store.createProject(owner, {
      address: "8 Test St, Carlton VIC 3053",
      lat: -37.81,
      lng: 144.96,
    });

    const result = await runFullPipeline(store, owner, project.id);

    expect(result.ok).toBe(true);
    expect(result.events.at(-1)).toEqual({ stage: "complete", status: "ok" });

    const survey = await store.getSurvey(owner, project.id);
    const design = await store.getDesign(owner, project.id);
    const costings = await store.listCostings(owner, project.id);
    const audit = await store.getAudit(owner, project.id);

    expect(survey).toBeTruthy();
    expect(design).toBeTruthy();
    expect(costings.length).toBe(3);
    expect(audit).toBeTruthy();
  });

  it("uses tier-1 design path for Wrights Terrace", async () => {
    const project = await store.createProject(owner, {
      address: "36 Wrights Terrace, Prahran VIC 3181",
      lat: -37.85,
      lng: 145.0,
    });

    const result = await runFullPipeline(store, owner, project.id);
    expect(result.ok).toBe(true);

    const design = await store.getDesign(owner, project.id);
    expect(design?.proposal.zones.some((z) => z.id === "front-entry")).toBe(true);

    const standard = (await store.listCostings(owner, project.id)).find(
      (c) => c.scenario === "standard",
    );
    expect(standard?.total).toBe(58410.35);
  });
});
