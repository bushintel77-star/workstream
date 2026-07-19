"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildSiteSchedule,
  edgeSegments,
  sheetBoxFor,
  type PaperSize,
  type PctPoint,
} from "../../geometry";
import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import css from "./fitSheet.module.css";

export const SHEET_SCALE_STEPS = [50, 100, 200, 250, 500] as const;
export type SheetScaleDenom = (typeof SHEET_SCALE_STEPS)[number];

type Props = {
  boardW: number;
  boardH: number;
  paper: PaperSize;
  address: string;
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  scaleM?: number;
  showElevations?: boolean;
  issuedLabel?: string;
  /** Architectural print scale 1:N — discrete snap ladder. */
  scaleDenom?: SheetScaleDenom;
  onScaleDenom?: (n: SheetScaleDenom) => void;
};

type ElevProfile = {
  label: string;
  widthM: number;
  bld0: number;
  bldW: number;
  bH: number;
  items: Array<{
    x: number;
    wPx: number;
    hPx: number;
    fill: string;
    stroke: string;
    dash: string;
  }>;
};

function buildElevProfile(
  axis: "x" | "y",
  boundary: PctPoint[],
  building: PctPoint[],
  items: StudioItem[],
  scaleM: number,
  rowH: number,
): ElevProfile {
  const coords = boundary.map((p) => (axis === "x" ? p.x : p.y));
  const minC = Math.min(...coords);
  const maxC = Math.max(...coords);
  const span = Math.max(1, maxC - minC);
  const widthM = (span / 100) * scaleM;

  const bCoords = building.map((p) => (axis === "x" ? p.x : p.y));
  const b0 = bCoords.length
    ? ((Math.min(...bCoords) - minC) / span) * 96 + 2
    : 30;
  const b1 = bCoords.length
    ? ((Math.max(...bCoords) - minC) / span) * 96 + 2
    : 55;
  const eaveH = 5;
  const maxHM = Math.max(
    eaveH,
    ...items
      .filter((i) => BY_TYPE[i.t].heightM)
      .map((i) => (BY_TYPE[i.t].heightM ?? 1) * i.scale),
    1,
  ) + 1;
  const groundB = 14;
  const usable = rowH - 28;
  const bH = (eaveH / maxHM) * usable;

  const elevItems = items
    .filter((i) => BY_TYPE[i.t].heightM)
    .map((it) => {
      const d = BY_TYPE[it.t];
      const c = axis === "x" ? it.x : it.y;
      const x = ((c - minC) / span) * 96 + 2;
      const hm = (d.heightM ?? 1) * it.scale;
      return {
        x,
        wPx: it.ghost ? 4 : 5,
        hPx: (hm / maxHM) * usable,
        fill: it.ghost ? "rgba(232,184,75,0.15)" : "rgba(194,69,95,0.18)",
        stroke: it.ghost ? "#E8B84B" : "#C2455F",
        dash: it.ghost ? "dashed" : "solid",
      };
    });

  return {
    label: axis === "x" ? "FRONT ELEVATION" : "SIDE ELEVATION",
    widthM,
    bld0: b0,
    bldW: Math.max(2, b1 - b0),
    bH,
    items: elevItems,
  };
}

function legendLines(items: StudioItem[]): { name: string; v: string }[] {
  const real = items.filter((i) => !i.ghost);
  const counts = new Map<string, number>();
  for (const i of real) {
    counts.set(i.t, (counts.get(i.t) ?? 0) + 1);
  }
  return [...counts.entries()].map(([t, n]) => ({
    name: BY_TYPE[t as keyof typeof BY_TYPE].name,
    v: `${n} no.`,
  }));
}

/**
 * Fit sheet chrome: centred A3/A4 paper frame, site schedule panel,
 * optional stacked front/side elevation profiles.
 */
export function FitSheetOverlay({
  boardW,
  boardH,
  paper,
  address,
  boundary,
  building,
  items,
  scaleM = 110,
  showElevations = false,
  issuedLabel,
  scaleDenom = 100,
  onScaleDenom,
}: Props) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 280);
    return () => window.clearTimeout(t);
  }, [scaleDenom]);

  useEffect(() => {
    if (!onScaleDenom) return;
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.("[data-testid='studio-board']")) return;
      e.preventDefault();
      const idx = SHEET_SCALE_STEPS.indexOf(scaleDenom);
      const dir = e.deltaY > 0 ? 1 : -1;
      const next =
        SHEET_SCALE_STEPS[
          Math.max(0, Math.min(SHEET_SCALE_STEPS.length - 1, idx + dir))
        ]!;
      if (next !== scaleDenom) onScaleDenom(next);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [onScaleDenom, scaleDenom]);

  const box = useMemo(
    () => sheetBoxFor(boardW, boardH, paper),
    [boardW, boardH, paper],
  );

  const schedule = useMemo(
    () => buildSiteSchedule(boundary, building, scaleM),
    [boundary, building, scaleM],
  );

  const segs = useMemo(() => {
    const b = edgeSegments(boundary, "B", scaleM);
    const f = edgeSegments(building, "F", scaleM);
    return [...b, ...f];
  }, [boundary, building, scaleM]);

  const legend = useMemo(() => legendLines(items), [items]);
  const showPanel = box.boxW >= 420;
  const scrimBot = Math.max(0, boardH - box.boxTop - box.boxH);

  const elevProfiles = useMemo(() => {
    if (!showElevations) return [];
    const rowH = 56;
    return [
      buildElevProfile("x", boundary, building, items, scaleM, rowH),
      buildElevProfile("y", boundary, building, items, scaleM, rowH),
    ];
  }, [showElevations, boundary, building, items, scaleM]);

  const elevPanelOn = elevProfiles.length > 0 && box.boxW >= 380;
  const elevPanelW = Math.max(
    160,
    box.boxW - 32 - (showPanel ? 262 + 16 : 0),
  );
  const elevPanelH = 56 * 2 + 34;

  const issued =
    issuedLabel ??
    new Date().toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const scaleTxt = `1:${scaleDenom}`;

  return (
    <>
      <div className={css.scrim} aria-hidden>
        <div
          className={css.scrimBand}
          style={{ left: 0, right: 0, top: 0, height: box.boxTop }}
        />
        <div
          className={css.scrimBand}
          style={{
            left: 0,
            right: 0,
            bottom: 0,
            height: scrimBot,
          }}
        />
        <div
          className={css.scrimBand}
          style={{
            left: 0,
            top: box.boxTop,
            width: box.boxLeft,
            height: box.boxH,
          }}
        />
        <div
          className={css.scrimBand}
          style={{
            left: box.boxLeft + box.boxW,
            top: box.boxTop,
            right: 0,
            height: box.boxH,
          }}
        />
      </div>

      <div
        className={`${css.frame}${pulse ? ` ${css.framePulse}` : ""}`}
        data-testid="fit-sheet-frame"
        data-paper={paper}
        data-scale={scaleTxt}
        style={{
          left: box.boxLeft,
          top: box.boxTop,
          width: box.boxW,
          height: box.boxH,
        }}
      >
        <div className={css.frameInner} />
        <div className={css.scaleHud} data-testid="fit-sheet-scale">
          {scaleTxt}
          <span className={css.scaleHint}>scroll to snap</span>
        </div>
      </div>

      {showPanel ? (
        <aside
          className={css.panel}
          data-testid="fit-sheet-schedule"
          style={{
            left: box.boxLeft + box.boxW - 262 - 16,
            top: box.boxTop + 16,
            bottom: scrimBot + 16,
          }}
        >
          <div className={css.panelHead}>
            <div style={{ minWidth: 0 }}>
              <p className={css.brand}>Curtis &amp; Co</p>
              <p className={css.addr}>{address}</p>
            </div>
            <span className={css.north}>N↑</span>
          </div>

          <div className={css.section}>
            <p className={css.kicker}>Site schedule</p>
            {(
              [
                ["Lot area", `${schedule.lotAreaM2.toFixed(2)} m²`],
                ["Building footprint", `${schedule.buildingAreaM2.toFixed(2)} m²`],
                ["Outdoor area", `${schedule.outdoorAreaM2.toFixed(2)} m²`],
                ["Site coverage", `${schedule.siteCoveragePct}%`],
                [
                  "Boundary perimeter",
                  `${schedule.boundaryPerimeterM.toFixed(2)} lm`,
                ],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className={css.row}>
                <span>{k}</span>
                <span className={css.mono}>{v}</span>
              </div>
            ))}
          </div>

          <div className={css.section}>
            <p className={css.kicker}>Boundary &amp; footprint dims</p>
            <div className={css.dimGrid}>
              {segs.map((s) => (
                <div key={s.key} className={css.dimRow}>
                  <span className={css.dimKey}>{s.key}</span>
                  <span>{s.lengthM.toFixed(2)} m</span>
                </div>
              ))}
            </div>
          </div>

          {legend.length > 0 ? (
            <div className={css.sectionGrow}>
              <p className={css.kicker}>Landscape legend</p>
              {legend.map((r) => (
                <div key={r.name} className={css.row}>
                  <span>{r.name}</span>
                  <span className={css.mono} style={{ color: "#7A5560" }}>
                    {r.v}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className={css.notes}>
            <p className={css.kicker}>Notes</p>
            <p className={css.notesBody}>
              Vicmap cadastral base · dimensions in metres. B# boundary segment ·
              F# building footprint. Working drawing — indicative only, not for
              construction.
            </p>
            <div className={css.notesMeta}>
              <span>{scaleTxt}</span>
              <span>{issued}</span>
            </div>
          </div>
        </aside>
      ) : null}

      {elevPanelOn ? (
        <div
          className={css.elevStack}
          data-testid="fit-sheet-elevations"
          style={{
            left: box.boxLeft + 16,
            bottom: scrimBot + 16,
            width: elevPanelW,
            height: elevPanelH,
          }}
        >
          {elevProfiles.map((pf) => (
            <div key={pf.label} className={css.elevRow}>
              <span className={css.elevLabel}>{pf.label}</span>
              <div className={css.elevGround} />
              <div
                className={css.elevBld}
                style={{
                  left: `${pf.bld0}%`,
                  width: `${pf.bldW}%`,
                  height: pf.bH,
                }}
              />
              {pf.items.map((pi, i) => (
                <div
                  key={i}
                  className={css.elevItem}
                  style={{
                    left: `${pi.x}%`,
                    width: pi.wPx,
                    height: pi.hPx,
                    background: pi.fill,
                    border: `1px ${pi.dash} ${pi.stroke}`,
                  }}
                />
              ))}
              <span className={css.elevWidth}>{pf.widthM.toFixed(1)} m</span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
