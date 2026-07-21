"use client";

import { useMemo } from "react";
import type { StudioItem, StudioMode } from "../../studioCatalog";
import type { PctPoint, SiteSchedule } from "../../geometry";
import { buildLiveMeasures } from "./buildLiveMeasures";
import { buildCanvasMeasureSummary } from "./buildMeasureSummary";
import css from "./canvasMeasureSummary.module.css";

type Props = {
  mode: StudioMode;
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  scaleM: number;
  schedule: SiteSchedule | null;
  selected: StudioItem | null;
  onOpen: () => void;
};

/** Small, stage-aware measurement card; click for the full live ledger. */
export function CanvasMeasureSummary({
  mode,
  boundary,
  building,
  items,
  scaleM,
  schedule,
  selected,
  onOpen,
}: Props) {
  const rows = useMemo(
    () =>
      buildLiveMeasures({
        boundary,
        building,
        items,
        scaleM,
        schedule,
        selected,
      }),
    [boundary, building, items, scaleM, schedule, selected],
  );
  const summary = useMemo(
    () =>
      buildCanvasMeasureSummary({
        mode,
        rows,
        acceptedItemCount: items.filter((item) => !item.ghost).length,
      }),
    [items, mode, rows],
  );

  if (summary.items.length === 0) return null;

  return (
    <button
      type="button"
      className={css.card}
      data-testid="canvas-measure-summary"
      data-mode={mode}
      onClick={onOpen}
      title="Open full live measurements"
    >
      <span className={css.head}>
        <span className={css.kicker}>{summary.kicker}</span>
        <span className={css.open} aria-hidden>
          ›
        </span>
      </span>
      <span className={css.metrics}>
        {summary.items.map((item) => (
          <span
            key={item.id}
            className={css.metric}
            data-testid={`canvas-measure-summary-${item.id}`}
          >
            <span className={css.label}>{item.label}</span>
            <span className={css.value}>{item.value}</span>
          </span>
        ))}
      </span>
    </button>
  );
}
