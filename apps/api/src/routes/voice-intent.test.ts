import { describe, expect, it } from "vitest";
import { VoiceIntentClassificationResponseSchema } from "@workstream/contracts";
import { buildTestApp } from "../test/build-app";

const OWNER = "dev-user";

describe("POST /projects/:id/voice-intent/classify", () => {
  it("classifies design language using the lexical fallback", async () => {
    const { app, store } = await buildTestApp();
    const project = await store.createProject(OWNER, {
      address: "36 Wrights Terrace, Prahran VIC 3181",
    });

    const res = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/voice-intent/classify`,
      payload: {
        transcript: "Create a 2.4 metre bluestone path",
        confidence: 0.85,
        dil_consent: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(VoiceIntentClassificationResponseSchema.safeParse(json).success).toBe(true);
    expect(json.kind).toBe("design");
    expect(json.classifier).toBe("lexical");
    expect(json.dil_recorded).toBe(false);
    await app.close();
  });

  it("classifies operational language using the lexical fallback", async () => {
    const { app, store } = await buildTestApp();
    const project = await store.createProject(OWNER, {
      address: "36 Wrights Terrace, Prahran VIC 3181",
    });

    const res = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/voice-intent/classify`,
      payload: {
        transcript: "Sam, check the western trench before the rain",
        confidence: 0.72,
        dil_consent: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(VoiceIntentClassificationResponseSchema.safeParse(json).success).toBe(true);
    expect(json.kind).toBe("dictation");
    expect(json.classifier).toBe("lexical");
    await app.close();
  });

  it("rejects missing confidence or DIL consent", async () => {
    const { app, store } = await buildTestApp();
    const project = await store.createProject(OWNER, {
      address: "36 Wrights Terrace, Prahran VIC 3181",
    });

    const res = await app.inject({
      method: "POST",
      url: `/projects/${project.id}/voice-intent/classify`,
      payload: {
        transcript: "Hello",
        dil_consent: true,
      },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 404 for an unknown project", async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/projects/unknown/voice-intent/classify",
      payload: {
        transcript: "Create a path",
        confidence: 0.9,
        dil_consent: true,
      },
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
