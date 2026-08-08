/**
 * Presence timing for canvas design chrome (material fans, ambient instruments).
 *
 * Generous atelier pacing — professional linger, not HUD snap:
 * - Long hold after disengage
 * - Soft ease in / ease out
 * - Rest stays clearly present while the mode is armed
 */

/**
 * Stay readable after pointer leaves before settling. One shared dwell for
 * every summoned surface (instruments, inventory, niche carousel) so presence
 * is predictable — long enough not to feel snatched away, short enough to
 * declutter without a manual dismiss.
 */
export const ATELIER_LINGER_MS = 4200;

/** CSS transition — engage / expand. Fast: a summon is a deliberate ask. */
export const ATELIER_ENTER_MS = 160;

/** CSS transition — settle / fade. */
export const ATELIER_EXIT_MS = 1200;

/** Soft presence while the tool mode is still armed. */
export const ATELIER_REST_OPACITY = 0.84;

/** Held after leave — fully readable. */
export const ATELIER_LINGER_OPACITY = 0.96;

export type AtelierPhase = "open" | "linger" | "rest";
