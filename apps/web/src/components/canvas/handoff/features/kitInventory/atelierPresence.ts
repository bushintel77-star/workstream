/**
 * Presence timing for canvas design chrome (material fans, ambient instruments).
 *
 * Generous atelier pacing — professional linger, not HUD snap:
 * - Long hold after disengage
 * - Soft ease in / ease out
 * - Rest stays clearly present while the mode is armed
 */

/** Stay readable after pointer leaves before settling. */
export const ATELIER_LINGER_MS = 5600;

/** CSS transition — engage / expand. */
export const ATELIER_ENTER_MS = 480;

/** CSS transition — settle / fade. */
export const ATELIER_EXIT_MS = 1200;

/** Soft presence while the tool mode is still armed. */
export const ATELIER_REST_OPACITY = 0.84;

/** Held after leave — fully readable. */
export const ATELIER_LINGER_OPACITY = 0.96;

export type AtelierPhase = "open" | "linger" | "rest";
