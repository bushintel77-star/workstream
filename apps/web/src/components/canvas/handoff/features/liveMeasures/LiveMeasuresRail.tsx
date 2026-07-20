"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StudioItem } from "../../studioCatalog";
import type { PctPoint, SiteSchedule } from "../../geometry";
import { buildLiveMeasures, type LiveMeasureRow } from "./buildLiveMeasures";
import css from "./liveMeasures.module.css";

type Props = {
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  scaleM: number;
  schedule: SiteSchedule | null;
  selected: StudioItem | null;
};

const GROUP_LABEL: Record<LiveMeasureRow["group"], string> = {
  site: "Site",
  edge: "Edges",
  material: "On plan",
  selection: "Selection",
};

/**
 * Live accumulating measurements — off the drawing, linked to geometry.
 * Numbers update as the plan moves; aria-live announces changes.
 */
export function LiveMeasuresRail({
  boundary,
  building,
  items,
  scaleM,
  schedule,
  selected,
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

  const prevRef = useRef<Map<string, number>>(new Map());
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [liveText, setLiveText] = useState("");

  useEffect(() => {
    const prev = prevRef.current;
    const nextFlash = new Set<string>();
    const changed: string[] = [];
    for (const row of rows) {
      const before = prev.get(row.id);
      if (before != null && Math.abs(before - row.numeric) > 0.02) {
        nextFlash.add(row.id);
        changed.push(`${row.label} ${row.value}`);
      }
      prev.set(row.id, row.numeric);
    }
    // Drop stale keys
    for (const key of [...prev.keys()]) {
      if (!rows.some((r) => r.id === key)) prev.delete(key);
    }
    if (nextFlash.size === 0) return;
    setFlashIds(nextFlash);
    setLiveText(changed.slice(0, 4).join(", "));
    const t = window.setTimeout(() => setFlashIds(new Set()), 700);
    return () => window.clearTimeout(t);
  }, [rows]);

  if (rows.length === 0) return null;

  const groups = (["site", "edge", "material", "selection"] as const).filter(
    (g) => rows.some((r) => r.group === g),
  );

  return (
    <aside
      className={css.rail}
      data-testid="live-measures-rail"
      aria-label="Live plan measurements"
    >
      <p className={css.kicker}>Live measures</p>
      <div className={css.srLive} aria-live="polite" aria-atomic="true">
        {liveText}
      </div>
      <div className={css.body}>
        {groups.map((g) => (
          <section key={g} className={css.group} data-group={g}>
            <h3 className={css.groupTitle}>{GROUP_LABEL[g]}</h3>
            <ul className={css.list}>
              {rows
                .filter((r) => r.group === g)
                .map((r) => (
                  <li
                    key={r.id}
                    className={`${css.row}${flashIds.has(r.id) ? ` ${css.flash}` : ""}`}
                    data-testid={`live-measure-${r.id}`}
                  >
                    <span className={css.label}>{r.label}</span>
                    <span className={css.value}>{r.value}</span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
