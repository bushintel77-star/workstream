import type { Store } from "@workstream/db";
import { transcribeAudio } from "./transcribe";

export async function runTranscription(
  store: Store,
  recordingId: string,
  filePath: string,
): Promise<void> {
  const recording = await store.getRecording(recordingId);
  if (!recording?.dil_consent) {
    throw new Error("DIL consent is required before transcription analysis");
  }
  const { transcript, confidence } = await transcribeAudio(filePath);
  await store.updateRecordingTranscript(recordingId, transcript, confidence);
}
