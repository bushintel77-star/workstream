import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { containedPath, safeFileSegment } from "./safe-path";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

const AUDIO_EXTS = new Set(["m4a", "webm"]);

function audioExt(audioUri: string): "m4a" | "webm" {
  return audioUri.endsWith(".webm") ? "webm" : "m4a";
}

/**
 * Recording ids are server-generated, but every path built from stored data
 * is re-validated here so a doctored row can never aim the writer outside
 * the uploads root.
 */
function containedAudioPath(recordingId: string, ext: string): string | null {
  const id = safeFileSegment(recordingId);
  if (!id) return null;
  const safeExt = AUDIO_EXTS.has(ext) ? ext : "m4a";
  return containedPath(UPLOAD_DIR, `${id}.${safeExt}`);
}

export async function saveAudio(
  recordingId: string,
  data: Buffer,
  ext = "m4a"
): Promise<string> {
  const filePath = containedAudioPath(recordingId, ext);
  if (!filePath) throw new Error("Invalid recording id");
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(filePath, data);
  return filePath;
}

export function audioPublicUrl(baseUrl: string, recordingId: string, ext = "m4a") {
  return `${baseUrl}/uploads/${recordingId}.${ext}`;
}

export function audioFilePath(recordingId: string, audioUri: string): string {
  const filePath = containedAudioPath(recordingId, audioExt(audioUri));
  /* Callers (capture pipeline) only ever pass store-generated ids; if one is
   * ever malformed, fail loudly rather than reading outside the uploads dir. */
  if (!filePath) throw new Error("Invalid recording id for audio path");
  return filePath;
}
