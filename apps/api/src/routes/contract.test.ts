import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectSchema } from "@workstream/contracts";
import { buildTestApp } from "../test/build-app";

describe("API contract — projects", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>["app"];

  afterEach(async () => {
    if (app) await app.close();
  });

  it("GET /healthz returns ok", async () => {
    ({ app } = await buildTestApp());
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { status: string };
    expect(body.status).toBe("ok");
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

    const siteContext = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/site-context`,
    });
    expect(siteContext.statusCode).toBe(200);
    expect(siteContext.json()).toHaveProperty("context");
  });
});
