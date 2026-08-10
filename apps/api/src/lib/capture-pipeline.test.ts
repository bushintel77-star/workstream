import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMemoryStore } from "@workstream/db";
import { runCapturePipeline } from "./capture-pipeline";

vi.mock("./transcription-job", () => ({
  runTranscription: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./survey-job", () => ({
  runSurvey: vi.fn().mockResolvedValue({ id: "s1" }),
}));

describe("runCapturePipeline", () => {
  const owner = "owner-capture-test";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transcribes then runs survey and sets survey_review", async () => {
    const store = createMemoryStore();
    await store.seedDefaults();
    const project = await store.createProject(owner, {
      address: "36 Wrights Terrace, Prahran VIC 3181",
      lat: -37.85,
      lng: 145.0,
    });
    const recording = await store.createRecording(owner, project.id, "", 120);
    if (!recording) throw new Error("recording missing");

    const { runTranscription } = await import("./transcription-job.js");
    const { runSurvey } = await import("./survey-job.js");

    await runCapturePipeline(
      store,
      owner,
      project.id,
      recording.id,
      "/tmp/fake.m4a",
    );

    expect(runTranscription).toHaveBeenCalledOnce();
    expect(runSurvey).toHaveBeenCalledOnce();
    const updated = await store.getProject(owner, project.id);
    expect(updated?.status).toBe("survey_review");
  });

  it("reverts to recording status when survey throws", async () => {
    const { runSurvey } = await import("./survey-job.js");
    vi.mocked(runSurvey).mockRejectedValueOnce(new Error("boom"));

    const store = createMemoryStore();
    await store.seedDefaults();
    const project = await store.createProject(owner, {
      address: "12 Test St, Melbourne VIC 3000",
    });
    const recording = await store.createRecording(owner, project.id, "", 60);
    if (!recording) throw new Error("recording missing");

    await expect(
      runCapturePipeline(
        store,
        owner,
        project.id,
        recording.id,
        "/tmp/fake.m4a",
      ),
    ).rejects.toThrow("boom");

    const updated = await store.getProject(owner, project.id);
    expect(updated?.status).toBe("recording");
  });
});
