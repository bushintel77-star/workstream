/**
 * Session artboard viewports (strategy §3) — Plan / Fit / Elev N·E·S·W.
 *
 * Borderless until active: chips that switch existing studio cameras/modes.
 * Not Stage 2 paper space, not a second DesignCanvas.
 *
 * Domain-pure: no server / DOM imports.
 */

export type ArtboardId =
  | "plan"
  | "fit"
  | "elev-N"
  | "elev-E"
  | "elev-S"
  | "elev-W";

export type ArtboardElevLook = "N" | "S" | "E" | "W";

export type StudioArtboard = {
  id: ArtboardId;
  label: string;
  /** Short chip label. */
  chip: string;
};

export const STUDIO_ARTBOARDS: readonly StudioArtboard[] = [
  { id: "plan", label: "Plan", chip: "Plan" },
  { id: "fit", label: "Fit sheet", chip: "Fit" },
  { id: "elev-N", label: "Elevation looking north", chip: "N" },
  { id: "elev-E", label: "Elevation looking east", chip: "E" },
  { id: "elev-S", label: "Elevation looking south", chip: "S" },
  { id: "elev-W", label: "Elevation looking west", chip: "W" },
] as const;

export function artboardElevLook(id: ArtboardId): ArtboardElevLook | null {
  if (id === "elev-N") return "N";
  if (id === "elev-E") return "E";
  if (id === "elev-S") return "S";
  if (id === "elev-W") return "W";
  return null;
}

export function elevLookArtboard(look: ArtboardElevLook): ArtboardId {
  return `elev-${look}` as ArtboardId;
}

/**
 * Which artboard is active from studio camera state.
 * Fit wins over plan; elevation mode wins over both.
 */
export function resolveActiveArtboard(input: {
  mode: string;
  frameOn: boolean;
  elevLook: ArtboardElevLook;
}): ArtboardId {
  if (input.mode === "elevation") return elevLookArtboard(input.elevLook);
  if (input.frameOn) return "fit";
  return "plan";
}
