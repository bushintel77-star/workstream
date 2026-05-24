import type { Store } from "@workstream/db";
import { transcribeAudio } from "./transcribe";

export async function runTranscription(
  store: Store,
  recordingId: string,
  filePath: string,
): Promise<void> {
  const { transcript, confidence } = await transcribeAudio(filePath);
  await store.updateRecordingTranscript(recordingId, transcript, confidence);
}
