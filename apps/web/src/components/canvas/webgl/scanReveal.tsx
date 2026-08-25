"use client";

/**
 * Scan reveal director — the per-frame heart of the choreographed
 * site-truth reveal. ONE component inside the R3F loop writes each stage's
 * 0→1 progress into a module singleton every frame; layer consumers
 * (boundary, easements, buildings, terrain, trees) read it inside their own
 * useFrame — no React re-renders, no prop drilling (the store's transient
 * doctrine applied to the scene graph).
 *
 * Outside a reveal every value is 1 — layers render exactly as before.
 * prefers-reduced-motion: all reveals resolve instantly (the AiScanOverlay
 * precedent — no sweep theatre).
 */

import { useFrame } from "@react-three/fiber";
import type { ScanChoreography, ScanStageName } from "./scanChoreography";
import { useStudioStore } from "./studioStore";
import { useReducedMotion } from "./useReducedMotion";

export type ScanRevealProgress = Record<ScanStageName, number>;

/** Idle = fully revealed; the director owns all writes during a scan. */
export const scanReveal: ScanRevealProgress = {
  cadastre: 1,
  parcels: 1,
  services: 1,
  terrain: 1,
  flora: 1,
};

function smoothstep(v: number): number {
  return v * v * (3 - 2 * v);
}

export function ScanRevealDirector({
  choreography,
}: {
  choreography: ScanChoreography | null;
}) {
  const reducedMotion = useReducedMotion();

  useFrame(() => {
    if (!choreography) return;
    const s = useStudioStore.getState();
    const activeIdx = choreography.events.findIndex((e) => e.stage === s.scanStage);
    for (let i = 0; i < choreography.events.length; i++) {
      const e = choreography.events[i]!;
      let v: number;
      if (reducedMotion) {
        v = s.scanStage === "idle" || activeIdx < 0 || i <= activeIdx ? 1 : 0;
      } else if (activeIdx < 0) {
        // idle/done (or no stage running): everything settled to full.
        v = 1;
      } else if (i < activeIdx) {
        v = 1; // stage already played
      } else if (i > activeIdx) {
        v = 0; // not yet reached
      } else {
        v = Math.min(1, (performance.now() - s.scanStageStartedAt) / e.durationMs);
      }
      scanReveal[e.stage] = smoothstep(v);
    }
  });

  return null;
}
