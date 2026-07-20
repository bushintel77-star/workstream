/**
 * Presence timing for canvas design chrome (kits, niche tools, ambient instruments).
 *
 * Generous atelier pacing — nothing sharp:
 * - Long hold after disengage
 * - Soft ease in / ease out
 * - Rest stays clearly present while the mode is armed
 */

/** Stay readable after pointer leaves before settling. */
export const ATELIER_LINGER_MS = 4800;

/** CSS transition — engage / expand. */
export const ATELIER_ENTER_MS = 420;

/** CSS transition — settle / fade. */
export const ATELIER_EXIT_MS = 1100;

/** Soft presence while the tool mode is still armed. */
export const ATELIER_REST_OPACITY = 0.84;

/** Held after leave — fully readable. */
export const ATELIER_LINGER_OPACITY = 0.96;

export type AtelierPhase = "open" | "linger" | "rest";
