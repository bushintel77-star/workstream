"use client";

import { BY_TYPE, type SpotLevel, type StudioItem } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
import css from "./surveyChecklist.module.css";

type Props = {
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  levels: SpotLevel[];
  services: PctPoint[][];
  easements?: PctPoint[][];
  onClose?: () => void;
  /** Unticked Existing dwelling — arm Trace → building. */
  onTraceBuilding?: () => void;
};

/**
 * Survey completeness checklist — right data lane occupant (lane law).
 */
export function SurveyChecklist({
  boundary,
  building,
  items,
  levels,
  services,
  easements = [],
  onClose,
  onTraceBuilding,
}: Props) {
  const dwellingOk = building.length >= 3;
  const rows: Array<{
    label: string;
    ok: boolean;
    onArm?: () => void;
    testId?: string;
  }> = [
    { label: "Boundary traced", ok: boundary.length >= 3 },
    {
      label: "Existing dwelling",
      ok: dwellingOk,
      onArm: !dwellingOk ? onTraceBuilding : undefined,
      testId: "survey-check-dwelling",
    },
    {
      label: "Existing trees",
      ok: items.some((i) => BY_TYPE[i.t]?.existing),
    },
    { label: "Spot levels", ok: levels.length > 0 },
    {
      label: "Services / easements",
      ok: services.length > 0 || easements.some((r) => r.length >= 3),
    },
  ];
  const done = rows.filter((r) => r.ok).length;
  const complete = done === rows.length;

  return (
    <aside
      className={css.root}
      data-testid="survey-checklist"
      aria-label="Survey checklist"
    >
      <div className={css.head}>
        <span className={css.title}>Survey checklist</span>
        <span
          className={`${css.count}${complete ? ` ${css.countDone}` : ""}`}
        >
          {done}/{rows.length}
        </span>
        {onClose ? (
          <button
            type="button"
            className={css.close}
            onClick={onClose}
            aria-label="Close checklist"
          >
            Close
          </button>
        ) : null}
      </div>
      <ul className={css.list}>
        {rows.map((row) => (
          <li
            key={row.label}
            className={css.row}
            data-done={row.ok ? "true" : "false"}
            data-testid={row.testId}
          >
            <span className={`${css.mark}${row.ok ? ` ${css.markOk}` : ""}`}>
              {row.ok ? "✓" : ""}
            </span>
            {row.onArm ? (
              <button
                type="button"
                className={css.armRow}
                onClick={row.onArm}
                data-testid="survey-arm-dwelling"
              >
                {row.label}
                <span className={css.armHint}>Trace</span>
              </button>
            ) : (
              <span className={row.ok ? css.labelOk : css.label}>
                {row.label}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className={css.foot}>
        {complete
          ? "Base complete — ready for CAD"
          : "Complete the base before designing"}
      </p>
    </aside>
  );
}
