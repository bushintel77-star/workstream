import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@workstream/db";
import { runSurvey } from "./survey-job";

describe("runSurvey", () => {
  let store: ReturnType<typeof createMemoryStore>;
  const owner = "test-user";

  beforeEach(() => {
    store = createMemoryStore();
  });

  it("rejects with a clear error when the project doesn't exist", async () => {
    await expect(
      runSurvey(store, owner, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(/Project not found/);
  });

  it("produces a survey with consistent area arithmetic", async () => {
    const project = await store.createProject(owner, {
      address: "1 Test St, Carlton VIC 3053",
    });

    const survey = await runSurvey(store, owner, project.id);

    expect(survey.lot_area_m2).toBeGreaterThan(0);
    expect(survey.house_area_m2).toBeGreaterThan(0);
    expect(survey.garden_area_m2).toBeGreaterThan(0);
    /* Garden = lot - house, give or take rounding. */
    const delta = Math.abs(
      survey.lot_area_m2 - survey.house_area_m2 - survey.garden_area_m2,
    );
    expect(delta).toBeLessThan(survey.lot_area_m2 * 0.05);
    expect(survey.measurements.length).toBeGreaterThanOrEqual(3);
  });

  it("persists the survey so a second getSurvey returns it", async () => {
    const project = await store.createProject(owner, {
      address: "2 Test St, Carlton VIC 3053",
    });
    const created = await runSurvey(store, owner, project.id);
    const fetched = await store.getSurvey(owner, project.id);
    expect(fetched?.id).toBe(created.id);
  });
});
