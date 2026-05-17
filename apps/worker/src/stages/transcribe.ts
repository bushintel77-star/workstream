// TODO: integrate OpenAI Whisper API for real transcription
export async function transcribe(
  audioUri: string,
): Promise<{ transcript: string; confidence: number }> {
  return { transcript: "", confidence: 0 };
}
