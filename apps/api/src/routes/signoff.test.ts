import { afterEach, describe, expect, it } from "vitest";
import { ProjectSignoffSchema } from "@workstream/contracts";
import { buildTestApp } from "../test/build-app";

describe("API — signoff", () => {
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
        address: "5 Boundary Rd, Kew VIC 3101",
        lat: -37.81,
        lng: 145.03,
      },
    });
    expect(res.statusCode).toBe(201);
    return (res.json() as { project: { id: string } }).project.id;
  }

  const disclaimers = [
    {
      id: "subsurface",
      kind: "subsurface",
      title: "Subsurface",
      statement: "Confirm services before digging.",
      trigger: "trench near unlocated service",
      required: true,
      cites: [],
      basis: "operator",
    },
    {
      id: "barrier",
      kind: "safety_waiver",
      title: "Safety",
      statement: "A pool needs a compliant barrier.",
      trigger: "pool drawn with no barrier",
      required: true,
      cites: [],
      basis: "operator",
    },
  ];

  function readyPayload(projectId: string): {
    project_id: string;
    revision: string;
    quote_total_incl_gst: number;
    accepted_notice_ids: string[];
    disclaimers: typeof disclaimers;
    acknowledged: Record<string, boolean>;
  } {
    return {
      project_id: projectId,
      revision: "rev-1",
      quote_total_incl_gst: 12500,
      accepted_notice_ids: ["subsurface", "barrier"],
      disclaimers,
      acknowledged: { subsurface: true, barrier: true },
    };
  }

  it("GET returns { signoff: null } before any signoff", async () => {
    const projectId = await createProject();
    const res = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/signoff`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ signoff: null });
  });

  it("PUT rejects when a required notice is unanswered (409 + readiness)", async () => {
    const projectId = await createProject();
    const payload = readyPayload(projectId);
    payload.acknowledged = { subsurface: true };
    const res = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/signoff`,
      payload,
    });
    expect(res.statusCode).toBe(409);
    const body = res.json() as { readiness: { ready: boolean } };
    expect(body.readiness.ready).toBe(false);
  });

  it("PUT signs off and GET round-trips an immutable ProjectSignoff", async () => {
    const projectId = await createProject();
    const put = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/signoff`,
      payload: readyPayload(projectId),
    });
    expect(put.statusCode).toBe(201);
    const putBody = put.json() as { signoff: unknown };
    const parsed = ProjectSignoffSchema.safeParse(putBody.signoff);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.status).toBe("signed_off");
    expect(parsed.data.revision).toBe("rev-1");
    expect(parsed.data.quote_total_incl_gst).toBe(12500);
    expect(parsed.data.signed_by).toBeTruthy();
    expect(parsed.data.signed_at).toBeTruthy();

    const get = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/signoff`,
    });
    expect(get.statusCode).toBe(200);
    const getBody = get.json() as { signoff: { status: string } };
    expect(getBody.signoff.status).toBe("signed_off");
  });

  it("a signed-off project cannot be re-signed (immutable, 409)", async () => {
    const projectId = await createProject();
    await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/signoff`,
      payload: readyPayload(projectId),
    });
    const again = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/signoff`,
      payload: readyPayload(projectId),
    });
    expect(again.statusCode).toBe(409);
  });

  it("returns 404 for a missing project", async () => {
    ({ app } = await buildTestApp());
    const missingId = "11111111-1111-4111-8111-111111111111";
    for (const method of ["GET", "PUT"] as const) {
      const res = await app.inject({
        method,
        url: `/projects/${missingId}/signoff`,
        payload: method === "PUT" ? readyPayload(missingId) : undefined,
      });
      expect(res.statusCode).toBe(404);
    }
  });
});
