/**
 * Presence timing for canvas design chrome (kits, niche tools, ambient instruments).
 *
 * Tuned to creative-tool norms — not combat HUDs:
 * - Hold ~3s after disengage so you can glance back without re-hunting the control
 * - Ease in ~280ms (available, not urgent)
 * - Ease out ~700ms (settle, not snap shut)
 * - Rest at soft opacity while the mode stays armed (spatial memory)
 *
 * Refs: common auto-hide toolbar / transient palette practice in canvas apps
 * (≈2.5–3.5s inactivity hold; 250–350ms enter; 500–800ms exit).
 */

/** Stay readable after pointer leaves or last interaction. */
export const ATELIER_LINGER_MS = 3000;

/** CSS transition — engage / expand. */
export const ATELIER_ENTER_MS = 280;

/** CSS transition — settle to rest. */
export const ATELIER_EXIT_MS = 700;

/** Soft presence while the tool mode is still armed. */
export const ATELIER_REST_OPACITY = 0.48;

/** Held after leave — still easy to read, before rest. */
export const ATELIER_LINGER_OPACITY = 0.88;

export type AtelierPhase = "open" | "linger" | "rest";
