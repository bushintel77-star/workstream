/**
 * Presence timing for canvas design chrome (kits, niche tools, ambient instruments).
 *
 * Design-tool norms — not combat HUDs:
 * - Hold after disengage so you can glance back
 * - Ease in gently; settle slowly
 * - Never vanish while the mode is armed — rest stays clearly present
 */

/** Stay expanded/readable after pointer leaves before compacting. */
export const ATELIER_LINGER_MS = 3000;

/** CSS transition — engage / expand. */
export const ATELIER_ENTER_MS = 280;

/** CSS transition — settle to compact rest. */
export const ATELIER_EXIT_MS = 700;

/**
 * Rest opacity while tool mode is still armed.
 * High enough that slots stay selectable — chrome does not disappear.
 */
export const ATELIER_REST_OPACITY = 0.82;

/** Held after leave — fully readable. */
export const ATELIER_LINGER_OPACITY = 0.94;

export type AtelierPhase = "open" | "linger" | "rest";
