import { afterEach, describe, expect, it } from "vitest";
import { ProjectOrchestrationWorldSchema } from "@workstream/contracts";
import { buildTestApp } from "../test/build-app";

describe("API — orchestration", () => {
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
        address: "99 Orchestration Way, Camberwell VIC 3124",
        lat: -37.83,
        lng: 145.06,
      },
    });
    expect(res.statusCode).toBe(201);
    return (res.json() as { project: { id: string } }).project.id;
  }

  it("GET returns a ProjectOrchestrationWorld for a fresh project", async () => {
    const projectId = await createProject();
    const res = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/orchestration`,
    });
    expect(res.statusCode).toBe(200);
    const parsed = ProjectOrchestrationWorldSchema.safeParse(res.json());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.project_id).toBe(projectId);
  });

  it("refresh returns a ProjectOrchestrationWorld and is idempotent", async () => {
    const projectId = await createProject();
    const r1 = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/orchestration/refresh`,
    });
    expect(r1.statusCode).toBe(200);
    const parsed1 = ProjectOrchestrationWorldSchema.safeParse(r1.json());
    expect(parsed1.success).toBe(true);

    const r2 = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/orchestration/refresh`,
    });
    expect(r2.statusCode).toBe(200);
    expect(
      ProjectOrchestrationWorldSchema.safeParse(r2.json()).success,
    ).toBe(true);
  });

  it("accept-overlay rejects a missing proposal_id with 400", async () => {
    const projectId = await createProject();
    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/orchestration/accept-overlay`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string; issues: unknown[] };
    expect(body.error).toBe("Validation failed");
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it("accept-overlay returns 404 for an unknown proposal_id", async () => {
    const projectId = await createProject();
    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/orchestration/accept-overlay`,
      payload: { proposal_id: "no-such-proposal" },
    });
    expect(res.statusCode).toBe(404);
    expect((res.json() as { error: string }).error).toBe(
      "Overlay proposal not found",
    );
  });

  it("dismiss-overlay rejects a missing proposal_id with 400", async () => {
    const projectId = await createProject();
    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/orchestration/dismiss-overlay`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string; issues: unknown[] };
    expect(body.error).toBe("Validation failed");
  });

  it("dismiss-overlay returns a ProjectOrchestrationWorld for any proposal_id", async () => {
    const projectId = await createProject();
    const res = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/orchestration/dismiss-overlay`,
      payload: { proposal_id: "no-such-proposal" },
    });
    expect(res.statusCode).toBe(200);
    expect(
      ProjectOrchestrationWorldSchema.safeParse(res.json()).success,
    ).toBe(true);
  });

  it("all routes return 404 for project-not-found", async () => {
    ({ app } = await buildTestApp());
    const missingId = "11111111-1111-4111-8111-111111111111";
    const cases = [
      { method: "GET", url: `/projects/${missingId}/orchestration` },
      {
        method: "POST",
        url: `/projects/${missingId}/orchestration/refresh`,
      },
      {
        method: "POST",
        url: `/projects/${missingId}/orchestration/accept-overlay`,
      },
      {
        method: "POST",
        url: `/projects/${missingId}/orchestration/dismiss-overlay`,
      },
    ] as const;
    for (const c of cases) {
      const res = await app.inject({
        method: c.method,
        url: c.url,
        payload: c.method === "POST" ? {} : undefined,
      });
      expect(res.statusCode).toBe(404);
    }
  });
});
