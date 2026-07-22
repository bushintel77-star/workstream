"use client";

import {
  DEFAULT_VIEW_ROTATION_STEP,
  VIEW_ROTATION_STEPS_DEG,
  isViewRotatedFromNorth,
  normalizeViewRotationDeg,
  resetViewRotationToNorth,
  stepViewRotationDeg,
  type ViewRotationStepDeg,
} from "../../geometry/canvasViewRotation";
import css from "./viewNorthControl.module.css";

type Props = {
  rotationDeg: number;
  stepDeg: ViewRotationStepDeg;
  onRotation: (deg: number) => void;
  onStep: (step: ViewRotationStepDeg) => void;
};

/**
 * CAD camera rotation — increment steps + reset to north.
 * Does not touch item.rot (asset handles stay independent).
 */
export function ViewNorthControl({
  rotationDeg,
  stepDeg,
  onRotation,
  onStep,
}: Props) {
  const rot = normalizeViewRotationDeg(rotationDeg);
  const offNorth = isViewRotatedFromNorth(rot);
  const step =
    VIEW_ROTATION_STEPS_DEG.find((s) => s === stepDeg) ??
    DEFAULT_VIEW_ROTATION_STEP;

  return (
    <div
      className={css.root}
      data-testid="view-north-control"
      data-rotated={offNorth ? "1" : "0"}
      role="group"
      aria-label="View rotation"
    >
      <span className={css.heading}>View</span>
      <div className={css.steps} role="group" aria-label="Rotation step">
        {VIEW_ROTATION_STEPS_DEG.map((s) => (
          <button
            key={s}
            type="button"
            className={`${css.stepBtn}${step === s ? ` ${css.stepBtnActive}` : ""}`}
            data-testid={`view-rot-step-${s}`}
            aria-pressed={step === s}
            title={`${s}° steps`}
            onClick={() => onStep(s)}
          >
            {s}°
          </button>
        ))}
      </div>
      <div className={css.actions}>
        <button
          type="button"
          className={css.iconBtn}
          data-testid="view-rot-ccw"
          aria-label={`Rotate view ${step} degrees counter-clockwise`}
          title={`Rotate −${step}°`}
          onClick={() => onRotation(stepViewRotationDeg(rot, -1, step))}
        >
          ↺
        </button>
        <button
          type="button"
          className={css.iconBtn}
          data-testid="view-rot-cw"
          aria-label={`Rotate view ${step} degrees clockwise`}
          title={`Rotate +${step}°`}
          onClick={() => onRotation(stepViewRotationDeg(rot, 1, step))}
        >
          ↻
        </button>
      </div>
      {offNorth ? (
        <button
          type="button"
          className={css.reset}
          data-testid="view-rot-reset-north"
          aria-label="Reset view to north"
          title="Reset to north"
          onClick={() => onRotation(resetViewRotationToNorth())}
        >
          N · reset
          <span className={css.deg} aria-hidden>
            {rot > 0 ? `+${Math.round(rot)}°` : `${Math.round(rot)}°`}
          </span>
        </button>
      ) : (
        <span className={css.northIdle} data-testid="view-rot-at-north">
          N
        </span>
      )}
    </div>
  );
}
