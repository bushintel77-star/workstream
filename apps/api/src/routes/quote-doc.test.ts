import { afterEach, describe, expect, it } from "vitest";
import { QuoteDocSchema } from "@workstream/contracts";
import { buildTestApp } from "../test/build-app";

describe("API — quote-doc", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>["app"];

  afterEach(async () => {
    if (app) await app.close();
  });

  async function createProject() {
    ({ app } = await buildTestApp());
    const res = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: {
        address: "8 Quote Test St, Richmond VIC 3121",
        lat: -37.82,
        lng: 145.0,
      },
    });
    expect(res.statusCode).toBe(201);
    return (res.json() as { project: { id: string } }).project.id;
  }

  it("returns null when no quote doc exists", async () => {
    const projectId = await createProject();
    const res = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/quote-doc`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ quoteDoc: null });
  });

  it("upserts overrides and margin without mutating the estimate engine", async () => {
    const projectId = await createProject();
    const put = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/quote-doc`,
      payload: {
        project_id: projectId,
        overrides: [{ line_id: "prim-pave", qty: 4, sku: "PAV-BLUE-SAWN" }],
        custom_lines: [],
        margin: { global_pct: 12, by_section: {} },
      },
    });
    expect(put.statusCode).toBe(200);
    const body = put.json() as { quoteDoc: unknown };
    const parsed = QuoteDocSchema.safeParse(body.quoteDoc);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.margin.global_pct).toBe(12);
    expect(parsed.data.overrides[0]?.qty).toBe(4);

    const get = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/quote-doc`,
    });
    expect(get.statusCode).toBe(200);
    expect((get.json() as { quoteDoc: { margin: { global_pct: number } } }).quoteDoc.margin.global_pct).toBe(12);
  });
});
