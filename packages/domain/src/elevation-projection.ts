export type ElevationItem = {
  id: string;
  label: string;
  xPct: number;
  widthPct: number;
  heightM: number;
  ghost: boolean;
  stale?: boolean;
};

/** @deprecated Prefer ElevationLook — front≈looking north, side≈looking east. */
export type ElevationAxis = "front" | "side";

/**
 * Cardinal look direction — look *toward* title north/east/south/west.
 * Board: x→east, y↓south.
 */
export type ElevationLook = "N" | "S" | "E" | "W";

export const ELEVATION_LOOKS: readonly ElevationLook[] = [
  "N",
  "E",
  "S",
  "W",
] as const;

export type ElevationProjector = {
  /** Plan axis sampled for the 1D elevation. */
  axis: "x" | "y";
  /** Mirror so left→right matches the looker's left. */
  reverse: boolean;
  label: string;
  shortLabel: string;
};

export function elevationLookProjector(look: ElevationLook): ElevationProjector {
  switch (look) {
    case "N":
      return {
        axis: "x",
        reverse: false,
        label: "Elevation looking north",
        shortLabel: "Looking N",
      };
    case "S":
      return {
        axis: "x",
        reverse: true,
        label: "Elevation looking south",
        shortLabel: "Looking S",
      };
    case "E":
      return {
        axis: "y",
        reverse: false,
        label: "Elevation looking east",
        shortLabel: "Looking E",
      };
    case "W":
      return {
        axis: "y",
        reverse: true,
        label: "Elevation looking west",
        shortLabel: "Looking W",
      };
  }
}

/** Next look in N→E→S→W cycle. */
export function cycleElevationLook(look: ElevationLook): ElevationLook {
  const i = ELEVATION_LOOKS.indexOf(look);
  return ELEVATION_LOOKS[(i + 1) % ELEVATION_LOOKS.length]!;
}

/** Companion look 90° CW — classic Fit sheet pair (e.g. N + E). */
export function elevationLookPair(look: ElevationLook): ElevationLook {
  return cycleElevationLook(look);
}

function lookFromLegacyAxis(axis: ElevationAxis): ElevationLook {
  return axis === "front" ? "N" : "E";
}

/** Project plan items onto a 1D elevation axis (indicative). */
export function projectElevationItems(
  items: Array<{
    id: string;
    label: string;
    x_pct: number;
    y_pct: number;
    scale?: number;
    height_m?: number;
    ghost?: boolean;
    stale?: boolean;
  }>,
  axisOrLook: ElevationAxis | ElevationLook,
  buildingHeightM = 2.7,
): { groundY: number; buildingH: number; items: ElevationItem[]; look: ElevationLook } {
  const look: ElevationLook =
    axisOrLook === "front" || axisOrLook === "side"
      ? lookFromLegacyAxis(axisOrLook)
      : axisOrLook;
  const proj = elevationLookProjector(look);
  const raw = items.map((it) => {
    const along = proj.axis === "x" ? it.x_pct : it.y_pct;
    const xPct = proj.reverse ? 100 - along : along;
    return {
      id: it.id,
      label: it.label,
      xPct,
      widthPct: Math.max(2, (it.scale ?? 1) * 4),
      heightM:
        it.height_m ??
        (it.label.toLowerCase().includes("tree") ? 4 : 1.2),
      ghost: Boolean(it.ghost),
      stale: it.stale,
    };
  });
  const sorted = [...raw].sort((a, b) => a.xPct - b.xPct);
  return {
    groundY: 0,
    buildingH: buildingHeightM,
    items: sorted,
    look,
  };
}
