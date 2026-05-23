import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@workstream/db";
import { runSurvey } from "./survey-job";
import { runDesign } from "./design-job";
import { runCosting } from "./cost-job";

describe("runCosting", () => {
  let store: ReturnType<typeof createMemoryStore>;
  const owner = "test-user";

  beforeEach(async () => {
    store = createMemoryStore();
    await store.seedDefaults();
  });

  it("fails clearly when design is missing", async () => {
    const project = await store.createProject(owner, {
      address: "1 Test St, Carlton VIC 3053",
    });
    await expect(runCosting(store, owner, project.id)).rejects.toThrow(
      /Design is required/,
    );
  });

  it("produces three scenarios with monotonic totals", async () => {
    const project = await store.createProject(owner, {
      address: "3 Test St, Carlton VIC 3053",
    });
    await runSurvey(store, owner, project.id);
    await runDesign(store, owner, project.id);
    const costings = await runCosting(store, owner, project.id);

    expect(costings.map((c) => c.scenario).sort()).toEqual([
      "buffer",
      "lean",
      "standard",
    ]);
    const lean = costings.find((c) => c.scenario === "lean")!;
    const standard = costings.find((c) => c.scenario === "standard")!;
    const buffer = costings.find((c) => c.scenario === "buffer")!;
    expect(lean.total).toBeLessThanOrEqual(standard.total);
    expect(standard.total).toBeLessThanOrEqual(buffer.total);
  });

  it("subtotals roll up to totals with 10% GST", async () => {
    const project = await store.createProject(owner, {
      address: "4 Test St, Carlton VIC 3053",
    });
    await runSurvey(store, owner, project.id);
    await runDesign(store, owner, project.id);
    const costings = await runCosting(store, owner, project.id);

    for (const c of costings) {
      const expectedGst = Math.round(c.subtotal * 0.1);
      expect(Math.abs(c.gst - expectedGst)).toBeLessThan(2);
      expect(Math.abs(c.total - (c.subtotal + c.gst))).toBeLessThan(2);
    }
  });

  it("aligns tier-1 standard scenario to proposal workbook total", async () => {
    const project = await store.createProject(owner, {
      address: "36 Wrights Terrace, Prahran VIC 3181",
      lat: -37.85,
      lng: 145.0,
    });
    await runSurvey(store, owner, project.id);
    await runDesign(store, owner, project.id);
    const costings = await runCosting(store, owner, project.id);

    const standard = costings.find((c) => c.scenario === "standard")!;
    expect(standard.total).toBe(58410.35);
    expect(
      standard.line_items.some((l) => l.sku === "ALW-TIER1-ALIGN"),
    ).toBe(true);
  });
});
