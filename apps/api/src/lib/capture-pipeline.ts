import type { Store } from "@workstream/db";
import { runTranscription } from "./transcription-job";
import { runSurvey } from "./survey-job";

/**
 * After a walkthrough upload: transcribe, then survey only.
 * Operator sketches on the aerial, then sketch estimate / develop-from-sketch.
 */
export async function runCapturePipeline(
  store: Store,
  ownerId: string,
  projectId: string,
  recordingId: string,
  audioPath: string,
  log?: { error: (obj: unknown, msg?: string) => void },
): Promise<void> {
  await store.updateProjectStatus(ownerId, projectId, "processing");

  try {
    await runTranscription(store, recordingId, audioPath);
    await runSurvey(store, ownerId, projectId);
    await store.updateProjectStatus(ownerId, projectId, "survey_review");
  } catch (err) {
    log?.error(err, "capture pipeline failed");
    await store.updateProjectStatus(ownerId, projectId, "recording");
    throw err;
  }
}
