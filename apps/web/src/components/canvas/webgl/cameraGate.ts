/**
 * Camera gate — per-rig orbit law (spec 6.1 / 1.4).
 *
 * Orbit (mod+drag) is a 3D-only gesture: PLAN and SEC are true measurement
 * views (plan = pan/zoom only; SEC = elevation), so they never orbit. AXO and
 * 3D orbit; AXO adds a 45° azimuth snap elsewhere in the settle path.
 */

export type CameraPreset = "plan" | "axo" | "sec" | "3d";

export function orbitAllowedForPreset(preset: CameraPreset): boolean {
  return preset === "axo" || preset === "3d";
}
