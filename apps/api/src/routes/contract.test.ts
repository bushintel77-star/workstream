import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectSchema } from "@workstream/contracts";
import { buildTestApp } from "../test/build-app";
import { signPortalToken } from "../lib/magic-link";

describe("API contract — projects", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>["app"];
  let store: Awaited<ReturnType<typeof buildTestApp>>["store"];

  afterEach(async () => {
    if (app) await app.close();
  });

  it("GET /healthz returns ok with durability fields", async () => {
    ({ app, store } = await buildTestApp());
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      status: string;
      ok: boolean;
      buildSha: string;
      dbWritable: boolean;
      records: number;
    };
    expect(body.status).toBe("ok");
    expect(body.ok).toBe(true);
    expect(typeof body.buildSha).toBe("string");
    expect(typeof body.dbWritable).toBe("boolean");
    expect(typeof body.records).toBe("number");
  });

  it("GET /readyz returns ok", async () => {
    ({ app, store } = await buildTestApp());
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect([200, 503]).toContain(res.statusCode);
    expect((res.json() as { status: string }).status).toMatch(/ok|degraded/);
  });

  it("POST /projects returns a Project-shaped body", async () => {
    ({ app } = await buildTestApp());
    const res = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: {
        address: "22 Contract Test St, Carlton VIC 3053",
        lat: -37.8,
        lng: 144.96,
      },
    });
    expect(res.statusCode).toBe(201);
    const parsed = ProjectSchema.safeParse(res.json().project);
    expect(parsed.success).toBe(true);
  });

  it("POST /projects rejects invalid input", async () => {
    ({ app } = await buildTestApp());
    const res = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "x" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "Validation failed" });
  });

  it("auth guard blocks protected routes when auth is required but Clerk is missing", async () => {
    ({ app } = await buildTestApp({ authRequired: true }));
    const res = await app.inject({ method: "GET", url: "/projects/" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      error: "Authentication is not configured",
    });
  });

  it("GET /projects lists Project[]", async () => {
    ({ app } = await buildTestApp());
    await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "1 List Test St, Carlton VIC 3053" },
    });
    const res = await app.inject({ method: "GET", url: "/projects/" });
    expect(res.statusCode).toBe(200);
    const projects = res.json().projects as unknown[];
    expect(projects.length).toBeGreaterThan(0);
    expect(ProjectSchema.safeParse(projects[0]).success).toBe(true);
  });

  it("GET /projects/:id/survey returns 404 when project missing", async () => {
    ({ app } = await buildTestApp());
    const res = await app.inject({
      method: "GET",
      url: `/projects/${randomUUID()}/survey`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Project not found" });
  });

  it("GET /readyz returns dependency readiness", async () => {
    ({ app } = await buildTestApp());
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect([200, 503]).toContain(res.statusCode);
    expect(res.json()).toHaveProperty("checks");
  });

  it("POST /projects/:id/pipeline honors Idempotency-Key", async () => {
    ({ app } = await buildTestApp());
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "Pipeline Idempotency St, Carlton VIC 3053" },
    });
    const projectId = (create.json() as { project: { id: string } }).project.id;
    const headers = { "idempotency-key": "contract-pipeline-run-1" };

    const first = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/pipeline`,
      headers,
    });
    const second = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/pipeline`,
      headers,
    });

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);
    expect(second.json()).toEqual(first.json());
  });

  it("POST /projects/:id/pipeline returns 404 for unknown project", async () => {
    ({ app } = await buildTestApp());
    const res = await app.inject({
      method: "POST",
      url: `/projects/${randomUUID()}/pipeline`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Project not found" });
  });

  it("covers geocode preview, search, and validation contracts", async () => {
    ({ app } = await buildTestApp());

    const preview = await app.inject({
      method: "GET",
      url: "/geocode/preview?lat=-37.84&lng=145.01",
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ lat: -37.84, lng: 145.01 });

    const search = await app.inject({
      method: "GET",
      url: "/geocode/search?q=Armadale",
    });
    expect(search.statusCode).toBe(200);
    expect(Array.isArray((search.json() as { suggestions: unknown[] }).suggestions)).toBe(
      true,
    );

    const invalid = await app.inject({
      method: "GET",
      url: "/geocode/preview?lat=999&lng=145",
    });
    expect(invalid.statusCode).toBe(400);
  });

  it("POST /projects/:id/survey returns 404 for unknown project", async () => {
    ({ app } = await buildTestApp());
    const res = await app.inject({
      method: "POST",
      url: `/projects/${randomUUID()}/survey`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Project not found" });
  });

  it.each([
    { label: "design", path: "design" },
    { label: "costing", path: "costing" },
    {
      label: "outputs",
      path: "outputs",
      payload: { kind: "quote" },
    },
  ])(
    "POST /projects/:id/$label returns 404 for unknown project",
    async ({ path, payload }) => {
      ({ app } = await buildTestApp());
      const res = await app.inject({
        method: "POST",
        url: `/projects/${randomUUID()}/${path}`,
        payload,
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Project not found" });
    },
  );

  it("PATCH task status requires owned project and matching task", async () => {
    ({ app } = await buildTestApp());
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "Task Contract St, Carlton VIC 3053" },
    });
    const projectId = (create.json() as { project: { id: string } }).project.id;
    const taskRes = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/tasks`,
      payload: { title: "Set out bed" },
    });
    const taskId = (taskRes.json() as { task: { id: string } }).task.id;

    const ok = await app.inject({
      method: "PATCH",
      url: `/projects/${projectId}/tasks/${taskId}/status`,
      payload: { status: "in_progress" },
    });
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { task: { status: string } }).task.status).toBe(
      "in_progress",
    );

    const wrongProject = await app.inject({
      method: "PATCH",
      url: `/projects/${randomUUID()}/tasks/${taskId}/status`,
      payload: { status: "done" },
    });
    expect(wrongProject.statusCode).toBe(404);
    expect(wrongProject.json()).toEqual({ error: "Project not found" });

    const wrongTask = await app.inject({
      method: "PATCH",
      url: `/projects/${projectId}/tasks/${randomUUID()}/status`,
      payload: { status: "done" },
    });
    expect(wrongTask.statusCode).toBe(404);
    expect(wrongTask.json()).toEqual({ error: "Task not found" });
  });

  it("smoke-tests project-scoped read routes across survey outputs and ops tabs", async () => {
    ({ app } = await buildTestApp());
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "Route Smoke St, Armadale VIC 3143" },
    });
    const projectId = (create.json() as { project: { id: string } }).project.id;

    const checks = [
      `/projects/${projectId}/design`,
      `/projects/${projectId}/costing`,
      `/projects/${projectId}/audit`,
      `/projects/${projectId}/overrides`,
      `/projects/${projectId}/outputs`,
      `/projects/${projectId}/tasks`,
      `/projects/${projectId}/recordings`,
      `/projects/${projectId}/measurements`,
      `/projects/${projectId}/design-canvas`,
      `/projects/${projectId}/gallery`,
      `/projects/${projectId}/files`,
      `/projects/${projectId}/weather`,
      `/projects/${projectId}/site-context`,
      `/projects/${projectId}/carbon`,
      `/projects/${projectId}/survey`,
      `/projects/${projectId}/cadastral-title`,
      `/projects/${projectId}/boundary`,
      `/projects/${projectId}/cad`,
    ];

    for (const url of checks) {
      const res = await app.inject({ method: "GET", url });
      expect([200, 404]).toContain(res.statusCode);
      expect(res.json()).toBeTypeOf("object");
    }
  });

  it("validates write contracts for design canvas, catalog, dictation, and uploads", async () => {
    ({ app } = await buildTestApp());
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "Validation Smoke St, Malvern VIC 3144" },
    });
    const projectId = (create.json() as { project: { id: string } }).project.id;

    const checks = [
      {
        method: "PUT" as const,
        url: `/projects/${projectId}/design-canvas`,
        payload: { placements: "bad" },
      },
      { method: "POST" as const, url: "/catalog/symbols", payload: { label: "" } },
      {
        method: "POST" as const,
        url: `/projects/${projectId}/dictation`,
        payload: { transcript: "" },
      },
      {
        method: "POST" as const,
        url: `/projects/${projectId}/measurements/photo`,
        payload: { image_base64: "" },
      },
      {
        method: "POST" as const,
        url: `/projects/${projectId}/aerial/upload`,
        payload: { not: "multipart" },
      },
    ] as const;

    for (const check of checks) {
      const res = await app.inject(check);
      expect([400, 406, 409, 415]).toContain(res.statusCode);
      expect(res.json()).toBeTypeOf("object");
    }
  });

  it("smoke-tests workspace integration, supplier, accounting, and catalog routes", async () => {
    ({ app } = await buildTestApp());

    const checks = [
      "/catalog/symbols",
      "/suppliers/",
      "/suppliers/bunnings",
      "/myob/status",
      "/myob/customers",
      "/myob/items",
      "/myob/sku-links",
      "/xero/status",
      "/xero/contacts",
      "/xero/items",
      "/integrations/summary",
      "/integrations/hub",
      "/settings/integrations",
      "/settings/rate-card",
      "/settings/plant-palette",
    ];

    for (const url of checks) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toBeTypeOf("object");
    }
  });

  it("smoke-tests integration hub write contracts", async () => {
    ({ app } = await buildTestApp());
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "Integration Write St, Carlton VIC 3053" },
    });
    const projectId = (create.json() as { project: { id: string } }).project.id;

    const checkout = await app.inject({
      method: "POST",
      url: "/integrations/plan/checkout",
      payload: {},
    });
    expect(checkout.statusCode).toBe(200);
    expect(checkout.json()).toMatchObject({
      mode: "dev_fallback",
      studio_price_configured: false,
    });

    const seats = await app.inject({
      method: "POST",
      url: "/integrations/plan/seats/checkout",
      payload: { extra_seats: 2 },
    });
    expect(seats.statusCode).toBe(200);
    expect(seats.json()).toMatchObject({
      mode: "dev_fallback",
      seat_price_configured: false,
    });

    const invalidHubTest = await app.inject({
      method: "POST",
      url: "/integrations/hub/test",
      payload: { channel: "not-real" },
    });
    expect(invalidHubTest.statusCode).toBe(400);

    const missingQuoteSync = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/integrations/sync`,
      payload: { include_portal: true },
    });
    expect(missingQuoteSync.statusCode).toBe(409);
    expect(missingQuoteSync.json()).toMatchObject({
      error: "Generate a quote output before syncing to CRM/email",
    });
  });

  it("mints separate portal quote and deposit tokens for client checkout", async () => {
    ({ app } = await buildTestApp());
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "Portal Deposit St, Armadale VIC 3143" },
    });
    const projectId = (create.json() as { project: { id: string } }).project.id;

    const survey = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/survey`,
    });
    expect(survey.statusCode).toBe(201);

    const design = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/design`,
    });
    expect(design.statusCode).toBe(201);

    const costing = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/costing`,
    });
    expect(costing.statusCode).toBe(201);

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
    const quoteBody = quote.json() as { deposit_url: string | null };
    expect(quoteBody.deposit_url).toMatch(/\/portal\/deposit\//);
    expect(quoteBody.deposit_url).not.toContain(token);

    const depositToken = new URL(quoteBody.deposit_url ?? "").pathname
      .split("/")
      .pop();
    expect(depositToken).toBeTruthy();

    const deposit = await app.inject({
      method: "POST",
      url: `/portal/deposit/${depositToken}`,
    });
    expect(deposit.statusCode).toBe(200);
    const depositBody = deposit.json() as {
      session: { mode: string; deposit_amount_aud: number };
    };
    expect(depositBody.session.mode).toBe("dev_fallback");
    expect(depositBody.session.deposit_amount_aud).toBeGreaterThan(0);
  });

  it("records project delete and restore in activity log", async () => {
    ({ app } = await buildTestApp());
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "Activity Audit St, Carlton VIC 3053" },
    });
    const projectId = (create.json() as { project: { id: string } }).project.id;

    const deleted = await app.inject({
      method: "DELETE",
      url: `/projects/${projectId}`,
    });
    expect(deleted.statusCode).toBe(204);

    const restored = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/restore`,
    });
    expect(restored.statusCode).toBe(200);

    const activity = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/activity`,
    });
    expect(activity.statusCode).toBe(200);
    const events = (activity.json() as { events: { action: string }[] }).events;
    expect(events.map((e) => e.action).sort()).toEqual([
      "project.deleted",
      "project.restored",
    ]);
  });

  it("records crew member delete in workspace activity log", async () => {
    ({ app } = await buildTestApp());
    const created = await app.inject({
      method: "POST",
      url: "/crew/",
      payload: {
        name: "Alex Site",
        role: "tradesperson",
        hourly_rate: 85,
      },
    });
    expect(created.statusCode).toBe(201);
    const memberId = (created.json() as { member: { id: string } }).member.id;

    const deleted = await app.inject({
      method: "DELETE",
      url: `/crew/${memberId}`,
    });
    expect(deleted.statusCode).toBe(204);

    const activity = await app.inject({
      method: "GET",
      url: "/settings/activity",
    });
    expect(activity.statusCode).toBe(200);
    const events = (activity.json() as { events: { action: string }[] }).events;
    expect(events.some((e) => e.action === "crew_member.deleted")).toBe(true);
  });

  it("protects file delivery with portal scope and project tombstones", async () => {
    ({ app, store } = await buildTestApp());
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "Protected Asset St, Carlton VIC 3053" },
    });
    const projectId = (create.json() as { project: { id: string } }).project.id;
    const recording = await store.createRecording(
      "dev-user",
      projectId,
      "/uploads/contract-asset.mp3",
      9,
    );
    expect(recording).not.toBeNull();
    if (!recording) throw new Error("Expected recording fixture");
    const uploadDir = path.join(process.cwd(), "data", "uploads");
    const filePath = path.join(uploadDir, `${recording.id}.mp3`);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(filePath, "contract audio");

    try {
      const quoteToken = signPortalToken({
        project_id: projectId,
        scope: "quote_view",
      });
      const depositToken = signPortalToken({
        project_id: projectId,
        scope: "deposit_checkout",
      });

      const wrongScope = await app.inject({
        method: "GET",
        url: `/uploads/${recording.id}.mp3?token=${depositToken}`,
      });
      expect(wrongScope.statusCode).toBe(403);
      expect(wrongScope.json()).toEqual({
        error: "Token scope does not allow file access",
      });

      const ok = await app.inject({
        method: "GET",
        url: `/uploads/${recording.id}.mp3?token=${quoteToken}`,
      });
      expect(ok.statusCode).toBe(200);
      expect(ok.headers["content-type"]).toBe("audio/mpeg");

      const deleted = await app.inject({
        method: "DELETE",
        url: `/projects/${projectId}`,
      });
      expect(deleted.statusCode).toBe(204);

      const hidden = await app.inject({
        method: "GET",
        url: `/uploads/${recording.id}.mp3?token=${quoteToken}`,
      });
      expect(hidden.statusCode).toBe(404);
      expect(hidden.json()).toEqual({ error: "File not found" });
    } finally {
      await rm(filePath, { force: true });
    }
  });

  it("smoke-covers studio AI, orchestration, and Stripe webhook routes", async () => {
    ({ app } = await buildTestApp());
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "Studio Route Smoke St, Armadale VIC 3143" },
    });
    const projectId = (create.json() as { project: { id: string } }).project.id;

    const ghosts = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/design/ghosts`,
    });
    expect(ghosts.statusCode).toBe(400);
    expect(ghosts.json()).toEqual({
      error: "Survey aerial required before AI scan.",
    });

    const assistInvalid = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/design/assist`,
      payload: { message: "" },
    });
    expect(assistInvalid.statusCode).toBe(400);
    expect(assistInvalid.json()).toHaveProperty("issues");

    const orchestration = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/orchestration`,
    });
    expect(orchestration.statusCode).toBe(200);
    expect(orchestration.json()).toHaveProperty("overlays");

    const overlayInvalid = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/orchestration/accept-overlay`,
      payload: { proposal_id: "" },
    });
    expect(overlayInvalid.statusCode).toBe(400);

    const webhook = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "content-type": "application/json" },
      payload: { id: "evt_contract", type: "payment_intent.succeeded", data: { object: {} } },
    });
    expect(webhook.statusCode).toBe(200);
    expect(webhook.json()).toEqual({ received: true });
  });

  it("smoke-covers geocode preview, catalog, suppliers, and project context routes", async () => {
    ({ app } = await buildTestApp());
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: {
        address: "36 Wrights Terrace, Prahran VIC 3181",
        lat: -37.8497,
        lng: 145.0189,
      },
    });
    const projectId = (create.json() as { project: { id: string } }).project.id;

    const preview = await app.inject({
      method: "GET",
      url: "/geocode/preview?lat=-37.8497&lng=145.0189",
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ lat: -37.8497, lng: 145.0189 });

    const invalidPreview = await app.inject({
      method: "GET",
      url: "/geocode/preview?lat=bad&lng=145.0189",
    });
    expect(invalidPreview.statusCode).toBe(400);

    const symbols = await app.inject({ method: "GET", url: "/catalog/symbols" });
    expect(symbols.statusCode).toBe(200);
    expect(Array.isArray(symbols.json().symbols)).toBe(true);

    const createdSymbol = await app.inject({
      method: "POST",
      url: "/catalog/symbols",
      payload: {
        label: "Contract olive",
        category: "planting",
        path_d: "M 0 0 L 10 0 L 10 10 Z",
      },
    });
    expect(createdSymbol.statusCode).toBe(201);

    const invalidSymbol = await app.inject({
      method: "POST",
      url: "/catalog/symbols",
      payload: { label: "", category: "planting", path_d: "x" },
    });
    expect(invalidSymbol.statusCode).toBe(400);

    const supplier = await app.inject({
      method: "GET",
      url: "/suppliers/speciality_trees",
    });
    expect(supplier.statusCode).toBe(200);

    const suppliers = await app.inject({
      method: "GET",
      url: "/suppliers/",
    });
    expect(suppliers.statusCode).toBe(200);
    expect(Array.isArray(suppliers.json().suppliers)).toBe(true);

    const search = await app.inject({
      method: "GET",
      url: "/geocode/search?q=Wrights%20Terrace",
    });
    expect(search.statusCode).toBe(200);
    expect(Array.isArray(search.json().suggestions)).toBe(true);

    const siteContext = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/site-context`,
    });
    expect(siteContext.statusCode).toBe(200);
    expect(siteContext.json()).toHaveProperty("context");

    const weather = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/weather`,
    });
    expect(weather.statusCode).toBe(200);
    expect(weather.json()).toHaveProperty("forecast");

    const carbon = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/carbon`,
    });
    expect(carbon.statusCode).toBe(404);
    expect(carbon.json()).toEqual({
      error: "Costing required before carbon estimate.",
    });
  });

  it("persists Fit-sheet presentation_pack on design-canvas upsert", async () => {
    ({ app } = await buildTestApp());
    const create = await app.inject({
      method: "POST",
      url: "/projects/",
      payload: { address: "Sheet Pack St, Richmond VIC 3121" },
    });
    const projectId = (create.json() as { project: { id: string } }).project.id;
    const widgetId = randomUUID();

    const put = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/design-canvas`,
      payload: {
        placements: [],
        strokes: [],
        presentation_pack: {
          theme: "blush",
          template_id: "curtis-client-brochure",
          widgets: [
            {
              id: widgetId,
              type: "quote_total",
              slot: "side_stack",
              order: 0,
              style: { accent: "rose", emphasis: "hero" },
            },
          ],
        },
      },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().canvas.presentation_pack).toMatchObject({
      theme: "blush",
      template_id: "curtis-client-brochure",
    });

    const get = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/design-canvas`,
    });
    expect(get.statusCode).toBe(200);
    expect(get.json().canvas.presentation_pack.widgets).toHaveLength(1);
    expect(get.json().canvas.presentation_pack.widgets[0].id).toBe(widgetId);
  });
});
