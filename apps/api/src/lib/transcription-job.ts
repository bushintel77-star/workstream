import type { Store } from "@construct/db";
import { transcribeAudio } from "./transcribe";

export async function runTranscription(
  store: Store,
  recordingId: string,
  filePath: string
): Promise<void> {
  const { transcript, confidence } = await transcribeAudio(filePath);
  await store.updateRecordingTranscript(recordingId, transcript, confidence);
}
