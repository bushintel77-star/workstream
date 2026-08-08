/**
 * Quiet material Foley for design placement — Age-of-Empires-tiny,
 * corporate-calm. Prefers CC0 samples; synthesizes a soft fallback.
 */

import type { StudioItemType } from "../../studioCatalog";

export type MaterialFamily =
  | "wood"
  | "stone"
  | "brick"
  | "soil"
  | "softscape"
  | "soft";

const FAMILY_BY_TYPE: Record<StudioItemType, MaterialFamily> = {
  deck: "wood",
  hedge: "wood",
  paving: "stone",
  lawn: "soil",
  bed: "soil",
  frenchdrain: "soil",
  canopy: "softscape",
  feature: "softscape",
  exist: "softscape",
};

const POOLS: Record<MaterialFamily, string[]> = {
  wood: [
    "/sfx/materials/wood_a.ogg",
    "/sfx/materials/wood_b.ogg",
    "/sfx/materials/wood_c.ogg",
    "/sfx/materials/wood_hit_a.ogg",
    "/sfx/materials/wood_plank.ogg",
  ],
  stone: [
    "/sfx/materials/stone_a.ogg",
    "/sfx/materials/stone_b.ogg",
    "/sfx/materials/brick_a.ogg",
  ],
  brick: [
    "/sfx/materials/brick_a.ogg",
    "/sfx/materials/brick_b.ogg",
    "/sfx/materials/brick_clack.ogg",
  ],
  soil: [
    "/sfx/materials/soil_a.ogg",
    "/sfx/materials/soil_b.ogg",
    "/sfx/materials/soil_c.ogg",
  ],
  softscape: [
    "/sfx/materials/softscape_a.ogg",
    "/sfx/materials/softscape_b.ogg",
    "/sfx/materials/soft_a.ogg",
  ],
  soft: ["/sfx/materials/soft_a.ogg", "/sfx/materials/ui_place.ogg"],
};

/** Corporate-quiet peak gain. */
const GAIN = 0.16;
const MIN_GAP_MS = 70;

let sharedCtx: AudioContext | null = null;
let lastPlay = 0;
const bufferCache = new Map<string, AudioBuffer | null>();
const loading = new Map<string, Promise<AudioBuffer | null>>();

function allowed(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    return false;
  }
  return true;
}

function ctx(): AudioContext | null {
  if (!allowed()) return null;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    if (!sharedCtx) sharedCtx = new AC();
    return sharedCtx;
  } catch {
    return null;
  }
}

async function loadBuffer(
  audio: AudioContext,
  url: string,
): Promise<AudioBuffer | null> {
  if (bufferCache.has(url)) return bufferCache.get(url) ?? null;
  const pending = loading.get(url);
  if (pending) return pending;
  const job = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        bufferCache.set(url, null);
        return null;
      }
      const raw = await res.arrayBuffer();
      const buf = await audio.decodeAudioData(raw.slice(0));
      bufferCache.set(url, buf);
      return buf;
    } catch {
      bufferCache.set(url, null);
      return null;
    } finally {
      loading.delete(url);
    }
  })();
  loading.set(url, job);
  return job;
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

/** Soft synthesized fallback if samples fail (filtered noise tick). */
function synthFallback(audio: AudioContext, family: MaterialFamily): void {
  const t0 = audio.currentTime;
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  const dur =
    family === "wood" ? 0.07 : family === "soil" ? 0.09 : family === "stone" ? 0.055 : 0.06;
  filter.frequency.value =
    family === "wood"
      ? 920
      : family === "soil"
        ? 380
        : family === "stone" || family === "brick"
          ? 1400
          : 700;
  filter.Q.value = family === "soil" ? 0.6 : 1.4;
  gain.gain.setValueAtTime(GAIN * 0.55, t0);
  gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);

  if (family === "wood" || family === "brick" || family === "stone") {
    const osc = audio.createOscillator();
    osc.type = "triangle";
    osc.frequency.value =
      family === "wood" ? 210 : family === "brick" ? 480 : 620;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
    return;
  }

  const len = Math.floor(audio.sampleRate * dur);
  const buf = audio.createBuffer(1, len, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = audio.createBufferSource();
  src.buffer = buf;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  src.start(t0);
}

function playBuffer(audio: AudioContext, buf: AudioBuffer): void {
  const t0 = audio.currentTime;
  const src = audio.createBufferSource();
  const gain = audio.createGain();
  src.buffer = buf;
  /* Slight pitch variance so repeats don't feel looped. */
  src.playbackRate.value = 0.94 + Math.random() * 0.12;
  gain.gain.value = GAIN;
  src.connect(gain);
  gain.connect(audio.destination);
  src.start(t0);
}

export function materialFamilyFor(type: StudioItemType): MaterialFamily {
  return FAMILY_BY_TYPE[type] ?? "soft";
}

/**
 * Play a quiet material cue for placing / painting a design concept.
 * Fire-and-forget; never throws into the UI path.
 */
export function playMaterialFoley(type: StudioItemType): void {
  const audio = ctx();
  if (!audio) return;
  const now = performance.now();
  if (now - lastPlay < MIN_GAP_MS) return;
  lastPlay = now;
  const family = materialFamilyFor(type);
  void audio.resume().catch(() => undefined);
  const url = pick(POOLS[family]);
  void loadBuffer(audio, url).then((buf) => {
    if (buf) playBuffer(audio, buf);
    else synthFallback(audio, family);
  });
}

/** Prefetch common pools after first gesture (optional). */
export function warmMaterialFoley(): void {
  const audio = ctx();
  if (!audio) return;
  const urls = [
    ...POOLS.wood.slice(0, 2),
    ...POOLS.stone.slice(0, 2),
    ...POOLS.soil.slice(0, 2),
    ...POOLS.softscape.slice(0, 2),
  ];
  for (const url of urls) void loadBuffer(audio, url);
}
