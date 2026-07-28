/**
 * Session restore for design lifecycle phase — complements durable
 * DesignCanvas.lifecycle_phase so the chip survives a soft reload.
 */

import {
  isDesignLifecyclePhase,
  type DesignLifecyclePhase,
} from "@workstream/domain";

export function loadLifecyclePhasePrefs(
  projectId: string,
): DesignLifecyclePhase | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`ws-design-phase:${projectId}`);
    return isDesignLifecyclePhase(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveLifecyclePhasePrefs(
  projectId: string,
  phase: DesignLifecyclePhase,
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`ws-design-phase:${projectId}`, phase);
  } catch {
    /* quota / private mode */
  }
}
