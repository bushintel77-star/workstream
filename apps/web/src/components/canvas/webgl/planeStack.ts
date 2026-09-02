/**
 * Fixed plane stack — spec §1.1 / §6.2.
 *
 * Four planes at real z-heights: Survey base −0.02 (imported, read-only),
 * Ground 0.00 (the drawing surface), Planting +1.50 and Massing +4.00
 * (proposed targets). Only the ground accepts drawing geometry today —
 * planting/massing render as honest reference bands until drawable-plane
 * support lands, so the chrome never advertises a target it cannot honour.
 */

export type FixedPlaneId = "survey" | "ground" | "planting" | "massing";

export interface FixedPlane {
  id: FixedPlaneId;
  name: string;
  z: number;
  state: "existing" | "proposed";
  readOnly: boolean;
  /** Accepts drawing geometry today (raycast + stroke capture). */
  drawable: boolean;
}

export const FIXED_PLANES: FixedPlane[] = [
  {
    id: "survey",
    name: "Survey base",
    z: -0.02,
    state: "existing",
    readOnly: true,
    drawable: false,
  },
  {
    id: "ground",
    name: "Ground",
    z: 0.0,
    state: "existing",
    readOnly: false,
    drawable: true,
  },
  {
    id: "planting",
    name: "Planting",
    z: 1.5,
    state: "proposed",
    readOnly: false,
    drawable: false,
  },
  {
    id: "massing",
    name: "Massing",
    z: 4.0,
    state: "proposed",
    readOnly: false,
    drawable: false,
  },
];

/** Short rail labels — the 3-letter mono codes the chrome uses. */
export const FIXED_PLANE_LABELS: Record<FixedPlaneId, string> = {
  survey: "SRV",
  ground: "GRD",
  planting: "PLT",
  massing: "MAS",
};

export function fixedPlaneById(id: string): FixedPlane | undefined {
  return FIXED_PLANES.find((p) => p.id === id);
}
