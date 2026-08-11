import { readFile } from "fs/promises";
import { getOwnerEnv } from "./owner-secrets";
import { fetchWithRetry } from "./http";

const DEV_TRANSCRIPT =
  "Pleached hornbeam screen along the west boundary at about two point four metres. " +
  "Mass planting of Lomandra Tanika to the front garden. Bluestone paving from the entry to the rear terrace. " +
  "Client wants low maintenance, no irrigation to the front.";

type WhisperSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

type WhisperVerboseResponse = {
  text: string;
  language: string;
  duration: number;
  segments: WhisperSegment[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function logProbToConfidence(avgLogprob: number): number {
  return clamp(Math.exp(avgLogprob), 0, 1);
}

function computeConfidence(segments: WhisperSegment[]): number {
  if (segments.length === 0) return 0.5;

  let totalTokens = 0;
  let weightedConfidence = 0;

  for (const segment of segments) {
    const tokenCount = Math.max(1, segment.tokens?.length ?? 1);
    const confidence = logProbToConfidence(segment.avg_logprob);
    const speechConfidence = 1 - clamp(segment.no_speech_prob, 0, 1);
    const blended = confidence * speechConfidence;
    weightedConfidence += blended * tokenCount;
    totalTokens += tokenCount;
  }

  return totalTokens > 0 ? clamp(weightedConfidence / totalTokens, 0, 1) : 0.5;
}

export async function transcribeAudio(
  filePath: string,
): Promise<{ transcript: string; confidence: number }> {
  const apiKey = getOwnerEnv("OPENAI_API_KEY");
  if (!apiKey) {
    return { transcript: DEV_TRANSCRIPT, confidence: 0.92 };
  }

  const buffer = await readFile(filePath);
  const form = new FormData();
  form.append(
    "file",
    new Blob([buffer], { type: "audio/m4a" }),
    pathBasename(filePath),
  );
  form.append("model", "whisper-1");
  form.append("language", "en");
  form.append("response_format", "verbose_json");

  const res = await fetchWithRetry(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    },
    {
      telemetry: {
        spanName: "openai.audio_transcription",
        provider: "openai",
        attributes: {
          "pipeline.stage": "transcribe",
          "model.name": "whisper-1",
        },
      },
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper failed: ${res.status} ${err}`);
  }

  const json = (await res.json()) as WhisperVerboseResponse;
  const transcript = json.text.trim();
  const confidence = computeConfidence(json.segments ?? []);
  return { transcript, confidence };
}

function pathBasename(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? "audio.m4a";
}
