import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "./transcribe";

const tmpDir = mkdtempSync(join(tmpdir(), "ws-transcribe-"));

let originalOpenAiKey: string | undefined;

beforeEach(() => {
  originalOpenAiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-openai-key";
});

afterEach(() => {
  process.env.OPENAI_API_KEY = originalOpenAiKey;
  vi.unstubAllGlobals();
});

describe("transcribeAudio", () => {
  it("returns provider confidence from Whisper verbose_json", async () => {
    const filePath = join(tmpDir, "audio.m4a");
    writeFileSync(filePath, Buffer.from("fake audio"));

    const payload = {
      text: "Plant a pleached hornbeam hedge along the west boundary.",
      language: "en",
      duration: 4.2,
      segments: [
        {
          id: 0,
          start: 0,
          end: 4.2,
          text: "Plant a pleached hornbeam hedge along the west boundary.",
          tokens: [1, 2, 3, 4, 5, 6, 7, 8],
          temperature: 0,
          avg_logprob: -0.105,
          compression_ratio: 1.2,
          no_speech_prob: 0.02,
        },
      ],
    };
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await transcribeAudio(filePath);

    expect(result.transcript).toBe(
      "Plant a pleached hornbeam hedge along the west boundary.",
    );
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.confidence).toBeLessThanOrEqual(1);

    const call = mockFetch.mock.calls[0];
    const body = call[1].body as FormData;
    expect(body.get("response_format")).toBe("verbose_json");
  });

  it("falls back to a default confidence when no segments are returned", async () => {
    const filePath = join(tmpDir, "audio2.m4a");
    writeFileSync(filePath, Buffer.from("fake audio"));

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          text: "No speech.",
          language: "en",
          duration: 1,
          segments: [],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await transcribeAudio(filePath);
    expect(result.confidence).toBe(0.5);
  });
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});
