import { afterEach, describe, expect, it } from "vitest";
import { ShareRevisionSchema } from "@workstream/contracts";
import { buildTestApp } from "../test/build-app";
import { SHARE_NOT_FOUND_BODY } from "./share";

const quoteBody = {
  quoteLines: [
    {
      id: "line-1",
      label: "Mass-planted Lomandra",
      unit: "m2",
      qty: 12,
      total: 1800,
    },
  ],
  totalInclGst: 1980,
};

describe("API — share revisions", () => {
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
        address: "22 Share Test St, Carlton VIC 3053",
        lat: -37.8,
        lng: 144.96,
      },
    });
    expect(res.statusCode).toBe(201);
    return (res.json() as { project: { id: string } }).project.id;
  }

  it("creates a share revision and returns a public payload", async () => {
    const projectId = await createProject();
    const create = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/share-revisions`,
      payload: quoteBody,
    });
    expect(create.statusCode).toBe(201);
    const body = create.json() as {
      revision: unknown;
      share_url: string;
    };
    const parsed = ShareRevisionSchema.safeParse(body.revision);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.revision).toBe("A");
    expect(parsed.data.status).toBe("shared");
    expect(body.share_url).toContain(`/share/${parsed.data.token}`);

    const pub = await app.inject({
      method: "GET",
      url: `/share/${parsed.data.token}`,
    });
    expect(pub.statusCode).toBe(200);
    expect(pub.json()).toMatchObject({
      revision: "A",
      status: "shared",
      snapshot: {
        totalInclGst: 1980,
        address: "22 Share Test St, Carlton VIC 3053",
      },
    });
    expect(pub.json()).not.toHaveProperty("token");
    expect(pub.json()).not.toHaveProperty("owner_id");
  });

  it("supersedes prior open revisions and increments the letter", async () => {
    const projectId = await createProject();
    const a = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/share-revisions`,
      payload: quoteBody,
    });
    expect(a.statusCode).toBe(201);
    const tokenA = (a.json() as { revision: { token: string } }).revision.token;

    const b = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/share-revisions`,
      payload: {
        ...quoteBody,
        totalInclGst: 2200,
        quoteLines: [
          { ...quoteBody.quoteLines[0]!, total: 2000, label: "Updated bed" },
        ],
      },
    });
    expect(b.statusCode).toBe(201);
    const revB = (b.json() as { revision: { revision: string; status: string } })
      .revision;
    expect(revB.revision).toBe("B");
    expect(revB.status).toBe("shared");

    const list = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/share-revisions`,
    });
    expect(list.statusCode).toBe(200);
    const revisions = (
      list.json() as { revisions: Array<{ revision: string; status: string }> }
    ).revisions;
    expect(revisions).toHaveLength(2);
    const byLetter = Object.fromEntries(
      revisions.map((r) => [r.revision, r.status]),
    );
    expect(byLetter.A).toBe("superseded");
    expect(byLetter.B).toBe("shared");

    // GET superseded looks like unknown — identical 404 body
    const supersededGet = await app.inject({
      method: "GET",
      url: `/share/${tokenA}`,
    });
    const unknownGet = await app.inject({
      method: "GET",
      url: "/share/this-token-does-not-exist-aaaaaaaaaaaaaaaa",
    });
    expect(supersededGet.statusCode).toBe(404);
    expect(unknownGet.statusCode).toBe(404);
    expect(supersededGet.body).toBe(unknownGet.body);
    expect(JSON.parse(supersededGet.body)).toEqual(SHARE_NOT_FOUND_BODY);
  });

  it("rejects unchanged re-share with 409", async () => {
    const projectId = await createProject();
    const first = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/share-revisions`,
      payload: quoteBody,
    });
    expect(first.statusCode).toBe(201);
    const again = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/share-revisions`,
      payload: quoteBody,
    });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ unchanged: true });
  });

  it("accepts a decision then rejects a second decision with 409", async () => {
    const projectId = await createProject();
    const create = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/share-revisions`,
      payload: quoteBody,
    });
    const token = (create.json() as { revision: { token: string } }).revision
      .token;

    const accept = await app.inject({
      method: "POST",
      url: `/share/${token}/decision`,
      payload: { kind: "accepted", clientName: "Alex Client" },
    });
    expect(accept.statusCode).toBe(200);
    expect(accept.json()).toMatchObject({
      ok: true,
      payload: {
        status: "accepted",
        decision: { kind: "accepted", clientName: "Alex Client" },
      },
    });

    const again = await app.inject({
      method: "POST",
      url: `/share/${token}/decision`,
      payload: { kind: "declined", clientName: "Alex Client" },
    });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: "Already decided" });
  });

  it("returns 410 when deciding on a superseded token", async () => {
    const projectId = await createProject();
    const a = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/share-revisions`,
      payload: quoteBody,
    });
    const tokenA = (a.json() as { revision: { token: string } }).revision.token;

    await app.inject({
      method: "POST",
      url: `/projects/${projectId}/share-revisions`,
      payload: {
        ...quoteBody,
        totalInclGst: 2500,
        quoteLines: [{ ...quoteBody.quoteLines[0]!, total: 2300 }],
      },
    });

    const decide = await app.inject({
      method: "POST",
      url: `/share/${tokenA}/decision`,
      payload: { kind: "accepted", clientName: "Alex Client" },
    });
    expect(decide.statusCode).toBe(410);
    expect(decide.json()).toMatchObject({
      error: "a newer version exists",
    });
  });

  it("persists share revisions through sqlite restart", async () => {
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { createMemoryStore } = await import("@workstream/db");

    const dir = mkdtempSync(join(tmpdir(), "ws-share-"));
    const dbPath = join(dir, "store.sqlite3");

    const store1 = createMemoryStore({ sqlitePath: dbPath });
    await store1.seedDefaults();
    const project = await store1.createProject("dev-user", {
      address: "Persist Share St, Melbourne VIC 3000",
      lat: -37.8,
      lng: 144.96,
    });
    const rev = await store1.createShareRevision("dev-user", project.id, {
      canvas: null,
      quoteLines: quoteBody.quoteLines,
      totalInclGst: 1980,
      address: project.address,
    });
    expect(rev?.token).toBeTruthy();
    store1._sqlite!.flush();
    store1._sqlite!.close();

    const store2 = createMemoryStore({ sqlitePath: dbPath });
    const listed = await store2.listShareRevisions("dev-user", project.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.token).toBe(rev!.token);
    expect(listed[0]!.status).toBe("shared");

    const decided = await store2.recordShareDecision(rev!.token, {
      kind: "accepted",
      clientName: "Pat Homeowner",
    });
    expect(decided.ok).toBe(true);
    store2._sqlite!.flush();
    store2._sqlite!.close();

    const store3 = createMemoryStore({ sqlitePath: dbPath });
    const again = await store3.getShareRevisionByToken(rev!.token);
    expect(again?.status).toBe("accepted");
    expect(again?.decision?.clientName).toBe("Pat Homeowner");
    store3._sqlite?.close();
  });
});
