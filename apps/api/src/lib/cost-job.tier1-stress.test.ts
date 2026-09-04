/**
 * Tier-1 costing stress — survey→design→costing lock to proposal workbook.
 * Run: pnpm exec vitest run apps/api/src/lib/cost-job.tier1-stress.test.ts
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@workstream/db";
import { runSurvey } from "./survey-job";
import { runDesign } from "./design-job";
import { runCosting } from "./cost-job";

const OWNER = "tier1-stress";
const TARGET = 58410.35;

const WRIGHTS_VARIANTS = [
  "36 Wrights Terrace, Prahran VIC 3181",
  "36 Wrights Tce, Prahran",
  "12 Wrights Terrace, Prahran",
  "WRIGHTS TERRACE, PRAHRAN",
];

/* Timeout sized for CI, not dev hardware: these suites are
 * correctness-under-repetition checks (identical lock across repeats), not
 * latency checks. On 2-core CI runners vitest runs every suite
 * concurrently, so the CPU-bound loops take ~3x their dev-machine wall
 * time and the old 20s describe budget timed out on slow runners while the
 * assertions themselves were green (2026-09-04, twice). */
describe("tier-1 stress · costing pipeline", { timeout: 90_000 }, () => {
  let store: ReturnType<typeof createMemoryStore>;

  beforeEach(async () => {
    store = createMemoryStore();
    await store.seedDefaults();
  });

  it(
    "locks standard total for every Wrights address variant",
    async () => {
      for (const address of WRIGHTS_VARIANTS) {
        const project = await store.createProject(OWNER, {
          address,
          lat: -37.85,
          lng: 145.0,
        });
        await runSurvey(store, OWNER, project.id);
        await runDesign(store, OWNER, project.id);
        const costings = await runCosting(store, OWNER, project.id);
        const standard = costings.find((c) => c.scenario === "standard");
        expect(standard, address).toBeTruthy();
        expect(standard!.total, address).toBe(TARGET);
        expect(
          standard!.line_items.some((l) => l.sku === "ALW-TIER1-ALIGN"),
          address,
        ).toBe(true);
      }
    },
    /* One full pipeline per address variant — headroom for parallel
     * related-suite runs (same law as the 15× repeat below). */
    120_000,
  );

  it("never locks non-tier-1 Carlton jobs onto the workbook total", async () => {
    const project = await store.createProject(OWNER, {
      address: "3 Test St, Carlton VIC 3053",
    });
    await runSurvey(store, OWNER, project.id);
    await runDesign(store, OWNER, project.id);
    const costings = await runCosting(store, OWNER, project.id);
    const standard = costings.find((c) => c.scenario === "standard")!;
    expect(standard.line_items.some((l) => l.sku === "ALW-TIER1-ALIGN")).toBe(
      false,
    );
    // Coincidence guard — Carlton mock must not accidentally equal workbook.
    if (standard.total === TARGET) {
      throw new Error("non-tier-1 total unexpectedly equals workbook lock");
    }
  });

  it(
    "repeats Wrights survey→design→cost 15 times with identical lock",
    async () => {
      const totals: number[] = [];
      for (let i = 0; i < 15; i++) {
        const project = await store.createProject(OWNER, {
          address: `36 Wrights Terrace, Prahran VIC 3181 #${i}`,
          lat: -37.85,
          lng: 145.0,
        });
        await runSurvey(store, OWNER, project.id);
        await runDesign(store, OWNER, project.id);
        const costings = await runCosting(store, OWNER, project.id);
        const standard = costings.find((c) => c.scenario === "standard")!;
        totals.push(standard.total);
        expect(standard.total).toBe(TARGET);
        const lean = costings.find((c) => c.scenario === "lean")!;
        const buffer = costings.find((c) => c.scenario === "buffer")!;
        expect(Number.isFinite(lean.total)).toBe(true);
        expect(Number.isFinite(buffer.total)).toBe(true);
      }
      expect(new Set(totals).size).toBe(1);
      expect(totals[0]).toBe(TARGET);
    },
    /* Address-keyed title search adds a live WFS round-trip per survey —
     * 15 full pipelines legitimately exceed the old 60s budget. */
    600_000,
  );

  it("re-costing the same project stays on the workbook lock", async () => {
    const project = await store.createProject(OWNER, {
      address: "36 Wrights Terrace, Prahran VIC 3181",
      lat: -37.85,
      lng: 145.0,
    });
    await runSurvey(store, OWNER, project.id);
    await runDesign(store, OWNER, project.id);
    for (let i = 0; i < 10; i++) {
      const costings = await runCosting(store, OWNER, project.id);
      const standard = costings.find((c) => c.scenario === "standard")!;
      expect(standard.total).toBe(TARGET);
    }
  });
});
