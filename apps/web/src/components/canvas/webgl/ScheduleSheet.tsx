"use client";

/**
 * Schedule sheet — the one light surface in the product (spec 6b / 9.1–9.5).
 * A read-only view derived from board geometry: planting, hardscape and
 * services tabs, a totals band with canopy cover, and CSV/PDF export.
 * No number here is stored — every row derives from placements/trenches/zones
 * through the domain ops-schedules builders (spec §9: derived, never persisted).
 */

import { useMemo, useState } from "react";
import { useStudioStore } from "./studioStore";
import {
  deriveScheduleSheet,
  type DerivedScheduleSheet,
  type ScheduleTab,
} from "./scheduleDerivation";
import s from "./ScheduleSheet.module.css";

export interface ScheduleSheetProps {
  /** Board width in metres — the ground scale for trench lengths. */
  scaleM: number;
  /** A2-6 canopy cover (provided/required trees); null = unasserted. */
  canopy?: { provided: number; required: number } | null;
  onClose: () => void;
}

const TABS: Array<{ id: ScheduleTab; label: string }> = [
  { id: "planting", label: "PLANTING" },
  { id: "hardscape", label: "HARDSCAPE" },
  { id: "services", label: "SERVICES" },
];

function toCsv(headers: string[], rows: (string | number | null)[][], honesty: string): string {
  const esc = (v: string | number | null) => {
    const t = v == null ? "" : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const body = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  return `${body}\n# ${honesty}\n`;
}

export function ScheduleSheet({ scaleM, canopy, onClose }: ScheduleSheetProps) {
  const placements = useStudioStore((st) => st.placements);
  const trenches = useStudioStore((st) => st.constructionTrenches);
  const irrigationZones = useStudioStore((st) => st.irrigationZones);
  const [tab, setTab] = useState<ScheduleTab>("planting");

  const data: DerivedScheduleSheet = useMemo(
    () =>
      deriveScheduleSheet({
        placements,
        trenches,
        irrigationZones,
        scaleM,
        canopy,
      }),
    [placements, trenches, irrigationZones, scaleM, canopy],
  );

  const now = new Date().toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const exportCsv = () => {
    let text: string;
    let name: string;
    if (tab === "planting") {
      text = toCsv(
        ["CODE", "BOTANICAL NAME", "POT", "SPREAD (m)", "QTY"],
        data.planting.rows.map((r) => [r.code, r.name, r.pot, r.spread, r.qty]),
        data.planting.honesty,
      );
      name = "schedule-planting.csv";
    } else if (tab === "hardscape") {
      text = toCsv(
        ["CODE", "MATERIAL", "SPREAD (m)", "QTY"],
        data.hardscape.rows.map((r) => [r.code, r.name, r.spread, r.qty]),
        data.hardscape.honesty,
      );
      name = "schedule-hardscape.csv";
    } else {
      text = [
        toCsv(
          ["NAME", "KIND", "LENGTH (m)", "DEPTH BAND", "SOURCE"],
          data.services.trenches.map((r) => [
            r.name,
            r.kind,
            r.lengthM,
            r.depthBand,
            r.source,
          ]),
          data.services.trenchHonesty,
        ),
        toCsv(
          ["FIXTURE", "QTY", "WATTS", "DESIGN VA", "GAUGE", "RUN (m)"],
          data.services.lighting.map((r) => [
            r.label,
            r.count,
            r.watts,
            r.designVa,
            r.gauge,
            r.runM,
          ]),
          data.services.lightingHonesty,
        ),
        data.services.transformer
          ? toCsv(
              ["TRANSFORMER", "DESIGN VA", "CAPACITY VA", "LOAD %"],
              [[
                data.services.transformer.overloaded ? "OVERLOADED" : "OK",
                data.services.transformer.designVa,
                data.services.transformer.capacityVa,
                Math.round(
                  (data.services.transformer.designVa /
                    Math.max(data.services.transformer.capacityVa, 1)) *
                    100,
                ),
              ]],
              data.services.honesty,
            )
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      name = "schedule-services.csv";
    }
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const honestEmpty = (label: string) => (
    <div className={s.empty}>
      No {label} — the schedule derives from what is placed on the board.
    </div>
  );

  /**
   * Phase O.2 — the empty schedule, drawn rather than silent.
   *
   * Each TAB already said it was empty, but an entirely empty board opened a
   * sheet whose CSV and PDF buttons were live: pressing either downloaded a
   * document containing a header row and an honesty footer and nothing else,
   * which reads as a schedule for a job with no work in it rather than as a
   * board nobody has drawn on yet. The sheet now names the state and the
   * exports are held until there is something to export.
   *
   * It is drawn on the paper surface in the sheet's own idiom, not with the
   * canvas `FailureState` card — the sheet is one of the two light surfaces
   * (Q.7), and dropping dark glass chrome into it would break that.
   */
  const isEmpty = data.totals.objectCount === 0;

  return (
    <div className={s.scrim} onClick={onClose} data-testid="schedule-scrim">
      <div
        className={s.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Schedule"
        data-testid="schedule-sheet"
      >
        <header className={s.head}>
          <div>
            <div className={s.title}>Schedule</div>
            <div className={s.meta}>
              LIVE FROM CANVAS · {data.totals.objectCount} objects · {now}
            </div>
          </div>
          <div className={s.actions}>
            <button
              type="button"
              className={s.actionBtn}
              onClick={exportCsv}
              disabled={isEmpty}
              title={
                isEmpty
                  ? "Nothing on the board to schedule"
                  : "Export this tab as CSV"
              }
            >
              CSV
            </button>
            <button
              type="button"
              className={s.actionBtn}
              onClick={() => window.print()}
              disabled={isEmpty}
              title={
                isEmpty ? "Nothing on the board to schedule" : "Print the schedule"
              }
            >
              PDF
            </button>
            <button type="button" className={s.actionBtn} onClick={onClose}>
              CLOSE
            </button>
          </div>
        </header>

        {!isEmpty && (
          <div className={s.tabs} role="tablist" aria-label="Schedule tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`${s.tab} ${tab === t.id ? s.tabActive : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {isEmpty ? (
          <div className={s.body}>
            <div
              className={s.emptySchedule}
              role="status"
              data-testid="schedule-empty"
            >
              <div className={s.emptyScheduleLabel}>EMPTY SCHEDULE</div>
              <p className={s.emptyScheduleTitle}>
                Nothing is placed on the board yet.
              </p>
              <p className={s.emptyScheduleDetail}>
                Every row here is derived — plants, paving, trenches and
                lighting are counted from what you draw, and none of it is
                stored. Place an asset or trace a run and the schedule fills
                itself in. Export is held until then, so an empty sheet cannot
                go out looking like a priced job with no work in it.
              </p>
            </div>
          </div>
        ) : (
        <div className={s.body}>
          {tab === "planting" &&
            (data.planting.rows.length > 0 ? (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Botanical name</th>
                    <th>Pot</th>
                    <th>Spread</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {data.planting.rows.map((r) => (
                    <tr key={r.code}>
                      <td className={s.mono}>{r.code}</td>
                      <td>{r.name}</td>
                      <td className={s.mono}>{r.pot}</td>
                      <td className={s.mono}>
                        {r.spread != null ? `${r.spread} m` : "—"}
                      </td>
                      <td className={s.mono}>{r.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              honestEmpty("planting")
            ))}

          {tab === "hardscape" &&
            (data.hardscape.rows.length > 0 ? (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Material</th>
                    <th>Spread</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hardscape.rows.map((r) => (
                    <tr key={r.code}>
                      <td className={s.mono}>{r.code}</td>
                      <td>{r.name}</td>
                      <td className={s.mono}>
                        {r.spread != null ? `${r.spread} m` : "—"}
                      </td>
                      <td className={s.mono}>{r.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              honestEmpty("hardscape materials")
            ))}

          {tab === "services" && (
            <div className={s.services}>
              {data.services.trenches.length > 0 && (
                <>
                  <div className={s.sectionLabel}>Trenches</div>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>Run</th>
                        <th>Kind</th>
                        <th>Length</th>
                        <th>Depth</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.services.trenches.map((r) => (
                        <tr key={`${r.name}-${r.kind}`}>
                          <td>{r.name}</td>
                          <td className={s.mono}>{r.kind}</td>
                          <td className={s.mono}>{r.lengthM} m</td>
                          <td className={s.mono}>{r.depthBand}</td>
                          <td className={s.mono}>{r.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {data.services.lighting.length > 0 && (
                <>
                  <div className={s.sectionLabel}>Lighting</div>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>Fixture</th>
                        <th>Qty</th>
                        <th>Watts</th>
                        <th>VA</th>
                        <th>Gauge</th>
                        <th>Run</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.services.lighting.map((r) => (
                        <tr key={r.label}>
                          <td>{r.label}</td>
                          <td className={s.mono}>{r.count}</td>
                          <td className={s.mono}>{r.watts}</td>
                          <td className={s.mono}>{r.designVa}</td>
                          <td className={s.mono}>{r.gauge}</td>
                          <td className={s.mono}>{r.runM} m</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.services.transformer && (
                    <div
                      className={`${s.transformer} ${data.services.transformer.overloaded ? s.transformerOver : ""}`}
                    >
                      Transformer load {Math.round(
                        (data.services.transformer.designVa /
                          Math.max(data.services.transformer.capacityVa, 1)) *
                          100,
                      )}
                      % — {data.services.transformer.designVa} VA of{" "}
                      {data.services.transformer.capacityVa} VA
                      {data.services.transformer.overloaded
                        ? " — over 80%, upgrade or reduce fixture load"
                        : ""}
                    </div>
                  )}
                </>
              )}
              {data.services.trenches.length === 0 &&
                data.services.lighting.length === 0 &&
                honestEmpty("services")}
            </div>
          )}
        </div>
        )}

        <footer className={s.totals}>
          <div className={s.totalsRow}>
            <span>Softscape {data.totals.softscapeCount}</span>
            <span>Hardscape {data.totals.hardscapeCount}</span>
            <span>Canopy cover {data.totals.canopyLabel}</span>
          </div>
          <div className={s.honesty}>
            {tab === "planting"
              ? data.planting.honesty
              : tab === "hardscape"
                ? data.hardscape.honesty
                : data.services.honesty}
          </div>
        </footer>
      </div>
    </div>
  );
}
