/**
 * Fortune-500 portal honesty — Tier-1 ledger payload + token scope isolation.
 * Run: pnpm exec vitest run apps/api/src/routes/portal.tier1-fortune500.test.ts
 */
import { afterEach, describe, expect, it } from "vitest";
import { TIER1_WRIGHTS_SAVINGS } from "@workstream/domain";
import { buildTestApp } from "../test/build-app";

const WRIGHTS = "36 Wrights Terrace, Prahran VIC 3181";
const CARLTON = "3 Test St, Carlton VIC 3053";
const TARGET = TIER1_WRIGHTS_SAVINGS.target_total_inc_gst;

/* Each case drives the full survey→design→cost pipeline before the quote
 * read — correctness, not latency. Budgeted for contended 2-core CI runners
 * where the pipeline runs ~3x its dev-machine time (2026-09-04). */
describe("fortune-500 · portal quote honesty", { timeout: 60_000 }, () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>["app"];

  afterEach(async () => {
    if (app) await app.close();
  });

  async function pipelineToCosting(address: string) {
    ({ app } = await buildTestApp());
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address, lat: -37.85, lng: 145.0 },
    });
    expect(create.statusCode).toBe(201);
    const projectId = (create.json() as { project: { id: string } }).project
      .id;

    expect(
      (await app.inject({ method: "POST", url: `/projects/${projectId}/survey` }))
        .statusCode,
    ).toBe(201);
    expect(
      (await app.inject({ method: "POST", url: `/projects/${projectId}/design` }))
        .statusCode,
    ).toBe(201);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/projects/${projectId}/costing`,
        })
      ).statusCode,
    ).toBe(201);

    return projectId;
  }

  it("Wrights portal quote exposes exact Tier-1 savings + locked costing", async () => {
    const projectId = await pipelineToCosting(WRIGHTS);
    const link = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/magic-link`,
      payload: { scope: "quote_view" },
    });
    expect(link.statusCode).toBe(200);
    const { token } = link.json() as { token: string };

    const quote = await app.inject({
      method: "GET",
      url: `/portal/quote/${token}`,
    });
    expect(quote.statusCode).toBe(200);
    const body = quote.json() as {
      tier1: typeof TIER1_WRIGHTS_SAVINGS | null;
      costing: { total: number; scenario: string } | null;
      project: { address: string };
    };
    expect(body.project.address).toContain("Wrights");
    expect(body.tier1).toEqual(TIER1_WRIGHTS_SAVINGS);
    expect(body.costing?.scenario).toBe("standard");
    expect(body.costing?.total).toBe(TARGET);
  });

  it("Carlton portal quote must not expose Tier-1 savings", async () => {
    const projectId = await pipelineToCosting(CARLTON);
    const link = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/magic-link`,
      payload: { scope: "quote_view" },
    });
    const { token } = link.json() as { token: string };
    const quote = await app.inject({
      method: "GET",
      url: `/portal/quote/${token}`,
    });
    expect(quote.statusCode).toBe(200);
    const body = quote.json() as {
      tier1: unknown;
      costing: { total: number } | null;
    };
    expect(body.tier1).toBeNull();
    expect(body.costing?.total).not.toBe(TARGET);
  });

  it("deposit-scope token cannot read quote (scope isolation)", async () => {
    const projectId = await pipelineToCosting(WRIGHTS);
    const link = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/magic-link`,
      payload: { scope: "deposit_checkout" },
    });
    const { token } = link.json() as { token: string };
    const quote = await app.inject({
      method: "GET",
      url: `/portal/quote/${token}`,
    });
    expect(quote.statusCode).toBe(403);
  });

  it("tampered / empty tokens are rejected", async () => {
    ({ app } = await buildTestApp());
    const bad = await app.inject({
      method: "GET",
      url: "/portal/quote/not-a-real-token",
    });
    expect(bad.statusCode).toBe(401);

    const empty = await app.inject({
      method: "GET",
      url: "/portal/quote/",
    });
    expect([401, 404]).toContain(empty.statusCode);
  });

  it("50 Wrights magic-links all return identical Tier-1 payload", async () => {
    const projectId = await pipelineToCosting(WRIGHTS);
    const payloads: unknown[] = [];
    for (let i = 0; i < 50; i++) {
      const link = await app.inject({
        method: "POST",
        url: `/projects/${projectId}/magic-link`,
        payload: { scope: "quote_view" },
      });
      const { token } = link.json() as { token: string };
      const quote = await app.inject({
        method: "GET",
        url: `/portal/quote/${token}`,
      });
      expect(quote.statusCode).toBe(200);
      const body = quote.json() as { tier1: unknown; costing: { total: number } };
      payloads.push(body.tier1);
      expect(body.costing.total).toBe(TARGET);
    }
    expect(new Set(payloads.map((p) => JSON.stringify(p))).size).toBe(1);
    expect(payloads[0]).toEqual(TIER1_WRIGHTS_SAVINGS);
  }, 30000);
});
