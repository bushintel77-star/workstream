/**
 * Fortune-500 Tier-1 API hardness — concurrency, pipeline lock, re-cost.
 * Run: pnpm exec vitest run apps/api/src/lib/tier1-fortune500.stress.test.ts
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@workstream/db";
import { runSurvey } from "./survey-job";
import { runDesign } from "./design-job";
import { runCosting } from "./cost-job";
import { runFullPipeline } from "./pipeline-job";

const OWNER = "tier1-f500";
const TARGET = 58410.35;
const WRIGHTS = "36 Wrights Terrace, Prahran VIC 3181";

/* See cost-job.tier1-stress.test.ts — budgets sized for contended 2-core CI
 * runners, where these CPU-bound repeats run ~3x their dev-machine time. */
describe("fortune-500 · costing concurrency + isolation", { timeout: 90_000 }, () => {
  let store: ReturnType<typeof createMemoryStore>;

  beforeEach(async () => {
    store = createMemoryStore();
    await store.seedDefaults();
  });

  it(
    "locks 12 concurrent Wrights projects to the workbook total",
    async () => {
      const projects = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          store.createProject(OWNER, {
            address: `${WRIGHTS} · concurrent-${i}`,
            lat: -37.85,
            lng: 145.0,
          }),
        ),
      );

      await Promise.all(
        projects.map(async (p) => {
          await runSurvey(store, OWNER, p.id);
          await runDesign(store, OWNER, p.id);
        }),
      );

      const costBatches = await Promise.all(
        projects.map((p) => runCosting(store, OWNER, p.id)),
      );

      for (const costings of costBatches) {
        const standard = costings.find((c) => c.scenario === "standard");
        expect(standard?.total).toBe(TARGET);
        expect(
          standard!.line_items.some((l) => l.sku === "ALW-TIER1-ALIGN"),
        ).toBe(true);
        const lean = costings.find((c) => c.scenario === "lean")!;
        const buffer = costings.find((c) => c.scenario === "buffer")!;
        expect(lean.line_items.some((l) => l.sku === "ALW-TIER1-ALIGN")).toBe(
          false,
        );
        expect(buffer.line_items.some((l) => l.sku === "ALW-TIER1-ALIGN")).toBe(
          false,
        );
        expect(Number.isFinite(lean.total)).toBe(true);
        expect(Number.isFinite(buffer.total)).toBe(true);
      }
    },
    120_000,
  );

  it(
    "mixed Wrights + Carlton batch never cross-contaminates the lock",
    async () => {
      const wrights = await store.createProject(OWNER, {
        address: WRIGHTS,
        lat: -37.85,
        lng: 145.0,
      });
      const carlton = await store.createProject(OWNER, {
        address: "3 Test St, Carlton VIC 3053",
        lat: -37.8,
        lng: 144.96,
      });

      await Promise.all(
        [wrights, carlton].map(async (p) => {
          await runSurvey(store, OWNER, p.id);
          await runDesign(store, OWNER, p.id);
        }),
      );

      const [wCost, cCost] = await Promise.all([
        runCosting(store, OWNER, wrights.id),
        runCosting(store, OWNER, carlton.id),
      ]);

      const wStd = wCost.find((c) => c.scenario === "standard")!;
      const cStd = cCost.find((c) => c.scenario === "standard")!;
      expect(wStd.total).toBe(TARGET);
      expect(wStd.line_items.some((l) => l.sku === "ALW-TIER1-ALIGN")).toBe(
        true,
      );
      expect(cStd.line_items.some((l) => l.sku === "ALW-TIER1-ALIGN")).toBe(
        false,
      );
      expect(cStd.total).not.toBe(TARGET);
    },
    60_000,
  );

  it(
    "full pipeline ×20 keeps identical Wrights standard lock",
    async () => {
      const totals: number[] = [];
      for (let i = 0; i < 20; i++) {
        const project = await store.createProject(OWNER, {
          address: `${WRIGHTS} #pipe-${i}`,
          lat: -37.85,
          lng: 145.0,
        });
        const result = await runFullPipeline(store, OWNER, project.id);
        expect(result.ok).toBe(true);
        const design = await store.getDesign(OWNER, project.id);
        expect(
          design?.proposal.zones.some((z) => z.id === "front-entry"),
        ).toBe(true);
        const standard = (await store.listCostings(OWNER, project.id)).find(
          (c) => c.scenario === "standard",
        )!;
        totals.push(standard.total);
        expect(standard.total).toBe(TARGET);
      }
      expect(new Set(totals).size).toBe(1);
    },
    600_000,
  );

  it("re-cost burst (25× sequential) on one project stays locked", async () => {
    const project = await store.createProject(OWNER, {
      address: WRIGHTS,
      lat: -37.85,
      lng: 145.0,
    });
    await runSurvey(store, OWNER, project.id);
    await runDesign(store, OWNER, project.id);

    for (let i = 0; i < 25; i++) {
      const costings = await runCosting(store, OWNER, project.id);
      const standard = costings.find((c) => c.scenario === "standard")!;
      expect(standard.total).toBe(TARGET);
    }
  });
});
