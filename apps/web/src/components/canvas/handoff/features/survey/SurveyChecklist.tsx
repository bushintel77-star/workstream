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
};

/**
 * Survey completeness checklist — ported from curtis-co prototype.
 */
export function SurveyChecklist({
  boundary,
  building,
  items,
  levels,
  services,
  easements = [],
}: Props) {
  const rows: Array<[string, boolean]> = [
    ["Boundary traced", boundary.length >= 3],
    ["Existing house outline", building.length >= 3],
    ["Existing trees", items.some((i) => BY_TYPE[i.t]?.existing)],
    ["Spot levels", levels.length > 0],
    [
      "Services / easements",
      services.length > 0 || easements.some((r) => r.length >= 3),
    ],
  ];
  const done = rows.filter((r) => r[1]).length;
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
      </div>
      <ul className={css.list}>
        {rows.map(([label, ok]) => (
          <li key={label} className={css.row} data-done={ok ? "true" : "false"}>
            <span className={`${css.mark}${ok ? ` ${css.markOk}` : ""}`}>
              {ok ? "✓" : ""}
            </span>
            <span className={ok ? css.labelOk : css.label}>{label}</span>
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
