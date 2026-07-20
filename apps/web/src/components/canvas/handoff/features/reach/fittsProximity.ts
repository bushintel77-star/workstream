/**
 * Canvas action clustering — Fitts’s Law + Gestalt proximity.
 *
 * - Fitts’s Law: time to hit a target rises with distance and falls with size.
 *   Keep the next action near the prime pixel (cursor / last selection).
 * - Law of Proximity: near elements read as one group; far ones as separate jobs.
 * - Marking menus: equal short radius from the hub beats a long linear strip.
 *
 * Object-local chrome (materials, lock, delete, instruments) stays inside
 * LOCAL_ACTION_PX of the selection/summon point. Telemetry may sit off-canvas.
 *
 * @see https://www.nngroup.com/articles/fitts-law/
 * @see https://lawsofux.com/law-of-proximity/
 */

/** Outer radius for object-local / summoned actions (px). */
export const LOCAL_ACTION_PX = 64;

/** Compact hub (deselect / identity) around the prime pixel. */
export const LOCAL_HUB_PX = 52;

/** Radial fan span — keeps slots equidistant (marking-menu pattern). */
export const LOCAL_ARC_SPAN_DEG = 140;
