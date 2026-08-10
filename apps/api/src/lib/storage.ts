import { mkdir, writeFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export async function saveAudio(
  recordingId: string,
  data: Buffer,
  ext = "m4a"
): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${recordingId}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);
  await writeFile(filePath, data);
  return filePath;
}

export function audioPublicUrl(baseUrl: string, recordingId: string, ext = "m4a") {
  return `${baseUrl}/uploads/${recordingId}.${ext}`;
}

export function audioFilePath(recordingId: string, audioUri: string): string {
  const ext = audioUri.endsWith(".webm") ? "webm" : "m4a";
  return path.join(UPLOAD_DIR, `${recordingId}.${ext}`);
}
