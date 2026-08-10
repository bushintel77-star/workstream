import { describe, expect, it } from "vitest";
import { createMemoryStore } from "@workstream/db";
import { runTranscription } from "./transcription-job";

describe("runTranscription", () => {
  it("requires DIL consent before transcription analysis", async () => {
    const store = createMemoryStore();
    const project = await store.createProject("owner-transcription-test", {
      address: "1 Consent St, Melbourne VIC 3000",
    });
    const recording = await store.createRecording(
      "owner-transcription-test",
      project.id,
      "https://example.com/audio.m4a",
      30,
    );
    if (!recording) throw new Error("recording missing");

    await expect(
      runTranscription(store, recording.id, "/tmp/not-read.m4a"),
    ).rejects.toThrow("DIL consent is required");
  });
});
