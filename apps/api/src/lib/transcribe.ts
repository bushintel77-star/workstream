import { readFile } from "fs/promises";

const DEV_TRANSCRIPT =
  "Pleached hornbeam screen along the west boundary at about two point four metres. " +
  "Mass planting of Lomandra Tanika to the front garden. Bluestone paving from the entry to the rear terrace. " +
  "Client wants low maintenance, no irrigation to the front.";

export async function transcribeAudio(
  filePath: string
): Promise<{ transcript: string; confidence: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { transcript: DEV_TRANSCRIPT, confidence: 0.92 };
  }

  const buffer = await readFile(filePath);
  const form = new FormData();
  form.append(
    "file",
    new Blob([buffer], { type: "audio/m4a" }),
    pathBasename(filePath)
  );
  form.append("model", "whisper-1");
  form.append("language", "en");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper failed: ${res.status} ${err}`);
  }

  const json = (await res.json()) as { text: string };
  return { transcript: json.text.trim(), confidence: 0.9 };
}

function pathBasename(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? "audio.m4a";
}
