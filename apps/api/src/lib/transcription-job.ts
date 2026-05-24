import type { Store } from "@workstream/db";
import { transcribeAudio } from "./transcribe";

export async function runTranscription(
  store: Store,
  recordingId: string,
  filePath: string,
  telemetry?: { project_id?: string; operator_id?: string },
): Promise<void> {
  const { transcript, confidence } = await transcribeAudio(filePath, telemetry);
  await store.updateRecordingTranscript(recordingId, transcript, confidence);
}
