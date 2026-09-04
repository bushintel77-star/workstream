/**
 * Fixed plane stack — spec §1.1 / §6.2.
 *
 * Four planes at real z-heights: Survey base −0.02 (imported, read-only),
 * Ground 0.00 (the drawing surface), Planting +1.50 and Massing +4.00
 * (proposed targets). Ground, Planting, and Massing all accept drawing
 * geometry — the Tidy conversion routes classified strokes to the correct
 * Z-band via `kindToPlane`, and the inline HUD cycle toggle lets the operator
 * override the classifier's default before commit.
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
    drawable: true,
  },
  {
    id: "massing",
    name: "Massing",
    z: 4.0,
    state: "proposed",
    readOnly: false,
    drawable: true,
  },
];

/**
 * Default Z-plane routing for a classified stroke kind.
 * `wall` → Massing (+4.0), `bed` → Planting (+1.5), `ditch`/`path` → Ground (0.0).
 * The inline Tidy HUD cycle toggle lets the operator override this before commit.
 */
export const KIND_TO_PLANE: Record<string, FixedPlaneId> = {
  wall: "massing",
  bed: "planting",
  ditch: "ground",
  path: "ground",
};

/** Z-height for a plane id. Returns 0 for unknown (ground default). */
export function planeZ(id: FixedPlaneId): number {
  return FIXED_PLANES.find((p) => p.id === id)?.z ?? 0;
}

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
