"use client";

import {
  GARDEN_VIEWPOINT_LOOKS,
  gardenViewpointLabel,
  type GardenViewpointLook,
} from "../tilt/tiltMath";
import css from "./gardenViewpoint.module.css";

type Props = {
  /** Armed axon preset while tilted; null when flat / off-cardinal. */
  activeLook: GardenViewpointLook | null;
  /** Elevation mode uses elevLook highlight instead. */
  elevLook?: GardenViewpointLook | null;
  mode: "plan" | "elevation";
  onSelect: (look: GardenViewpointLook) => void;
};

/**
 * Meta-chip cardinal strip. Plan: settles named 3D axon. Elevation: sets look
 * direction.
 *
 * Renders *in flow* inside the top-edge `FrameDrawer`, beside `ArtboardStrip`,
 * which already portals to the gallery frame. Do not wrap this in its own
 * `CameraChrome`: a second portal escapes the drawer and drops the strip onto
 * the drawing with whatever absolute offset its CSS still carries (`7a3b7ed`).
 */
export function GardenViewpointStrip({
  activeLook,
  elevLook = null,
  mode,
  onSelect,
}: Props) {
  const armed = mode === "elevation" ? elevLook : activeLook;
  return (
    <div
      className={css.strip}
      role="group"
      aria-label="Garden viewpoints"
      data-testid="garden-viewpoint-strip"
      data-mode={mode}
    >
      <span className={css.kicker}>View</span>
      {GARDEN_VIEWPOINT_LOOKS.map((look) => {
        const on = armed === look;
        return (
          <button
            key={look}
            type="button"
            className={`${css.chip}${on ? ` ${css.chipOn}` : ""}`}
            data-testid={`garden-viewpoint-${look}`}
            data-armed={on ? "1" : "0"}
            aria-pressed={on}
            title={gardenViewpointLabel(look)}
            onClick={() => onSelect(look)}
          >
            {look}
          </button>
        );
      })}
    </div>
  );
}
