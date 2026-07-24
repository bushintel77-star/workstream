"use client";

import {
  GARDEN_VIEWPOINT_LOOKS,
  gardenViewpointLabel,
  type GardenViewpointLook,
} from "../tilt/tiltMath";
import { CameraChrome } from "../../CameraChrome";
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
 * Meta-chip cardinal strip — CameraChrome dock only (never under zoom-world).
 * Plan: settles named 3D axon. Elevation: sets look direction.
 */
export function GardenViewpointStrip({
  activeLook,
  elevLook = null,
  mode,
  onSelect,
}: Props) {
  const armed = mode === "elevation" ? elevLook : activeLook;
  return (
    <CameraChrome place={{ kind: "dock" }} testId="garden-viewpoint-strip">
      <div
        className={css.strip}
        role="group"
        aria-label="Garden viewpoints"
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
    </CameraChrome>
  );
}
