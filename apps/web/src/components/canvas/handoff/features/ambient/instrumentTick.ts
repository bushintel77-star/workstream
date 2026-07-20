/**
 * Soft detent tick for instrument carousel — purposeful feedback, not decoration.
 * No-ops under reduced motion or when AudioContext is unavailable.
 */
let sharedCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    return null;
  }
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

/** Quiet mechanical click — carousel step / tool arm. */
export function playInstrumentTick(kind: "step" | "arm" = "step"): void {
  const audio = ctx();
  if (!audio) return;
  void audio.resume().catch(() => undefined);
  const t0 = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "triangle";
  osc.frequency.value = kind === "arm" ? 620 : 840;
  gain.gain.setValueAtTime(kind === "arm" ? 0.028 : 0.018, t0);
  gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.045);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + 0.05);
}
