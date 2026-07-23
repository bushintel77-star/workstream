"use client";

import { useEffect, useMemo, useState } from "react";
import type { ArchitecturalTitleBlock } from "@workstream/domain";
import {
  buildWorkableSiteSchedule,
  resolveFitSheetAreas,
  SHEET_INNER_MARGIN,
  SHEET_PANEL_GAP,
  SHEET_SCALE_STEPS,
  sheetBoxFor,
  titlePanelWidth,
  type PaperSize,
  type PctPoint,
  type SheetScaleDenom,
} from "../../geometry";
import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import css from "./fitSheet.module.css";

/** Ladder lives in geometry (single source shared with sheetContentView). */
export { SHEET_SCALE_STEPS, type SheetScaleDenom };

type Props = {
  boardW: number;
  boardH: number;
  paper: PaperSize;
  address: string;
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  easements?: PctPoint[][];
  services?: PctPoint[][];
  scaleM?: number;
  showElevations?: boolean;
  issuedLabel?: string;
  /** Architectural print scale 1:N — discrete snap ladder. */
  scaleDenom?: SheetScaleDenom;
  onScaleDenom?: (n: SheetScaleDenom) => void;
  /** Live Vicmap cadastral title block for the selected address. */
  titleBlock?: ArchitecturalTitleBlock | null;
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
        fill: it.ghost ? "rgba(28,25,23,0.05)" : "rgba(28,25,23,0.1)",
        stroke: it.ghost ? "#6B6560" : "#1C1917",
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

/** Indicative m² from catalog px footprint × scale at board metres. */
function itemAreaM2(it: StudioItem, scaleM: number): number {
  const d = BY_TYPE[it.t];
  const wm = ((d.w * it.scale) / 960) * scaleM;
  const hm = ((d.h * it.scale) / 640) * scaleM;
  if (d.area === "ellipse") return (Math.PI / 4) * wm * hm;
  if (d.area === "rect") return wm * hm;
  if (d.canopyM) {
    const r = (d.canopyM * it.scale) / 2;
    return Math.PI * r * r;
  }
  return 0;
}

function legendLines(
  items: StudioItem[],
  scaleM: number,
): { name: string; v: string }[] {
  const real = items.filter((i) => !i.ghost);
  const areas = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const i of real) {
    counts.set(i.t, (counts.get(i.t) ?? 0) + 1);
    areas.set(i.t, (areas.get(i.t) ?? 0) + itemAreaM2(i, scaleM));
  }
  return [...counts.entries()].map(([t, n]) => {
    const m2 = areas.get(t) ?? 0;
    const name = BY_TYPE[t as keyof typeof BY_TYPE].name;
    if (m2 > 0.05) {
      return { name, v: `${m2.toFixed(1)} m²` };
    }
    return { name, v: `${n} no.` };
  });
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
  easements = [],
  services = [],
  scaleM = 110,
  showElevations = false,
  issuedLabel,
  scaleDenom = 100,
  onScaleDenom,
  titleBlock = null,
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
      // Print 1:N only with Alt+wheel — plain wheel is infinite zoom on the
      // board (HandoffDesignStudio), including while Fit sheet is on.
      if (!e.altKey) return;
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
    () =>
      buildWorkableSiteSchedule({
        boundary,
        building,
        easements,
        services,
        items,
        scaleM,
      }),
    [boundary, building, easements, services, items, scaleM],
  );

  /** Drawn footprint wins — never template/survey house_area (1 m² bug). */
  const areas = useMemo(
    () =>
      resolveFitSheetAreas({
        schedule,
        cadastralLotM2: titleBlock?.lotAreaM2,
      }),
    [schedule, titleBlock?.lotAreaM2],
  );

  const legend = useMemo(() => legendLines(items, scaleM), [items, scaleM]);
  const panelW = titlePanelWidth(box.boxW);
  const showPanel = panelW > 0;
  const scrimBot = Math.max(0, boardH - box.boxTop - box.boxH);
  const inset = SHEET_INNER_MARGIN;

  const elevProfiles = useMemo(() => {
    if (!showElevations) return [];
    const rowH = 56;
    return [
      buildElevProfile("x", boundary, building, items, scaleM, rowH),
      buildElevProfile("y", boundary, building, items, scaleM, rowH),
    ];
  }, [showElevations, boundary, building, items, scaleM]);

  const elevPanelOn = elevProfiles.length > 0 && box.boxW >= 280;
  const elevPanelW = Math.max(
    140,
    box.boxW -
      inset * 2 -
      (showPanel ? panelW + SHEET_PANEL_GAP : 0),
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
    <div
      className={css.layer}
      data-print-keep="sheet"
      data-testid="fit-sheet-layer"
    >
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
        <div
          className={css.frameInner}
          style={{ inset: inset }}
        />
        <div className={css.scaleHud} data-testid="fit-sheet-scale">
          {scaleTxt}
          <span className={css.scaleHudHint}>Alt+wheel · print scale</span>
        </div>
      </div>

      {showPanel ? (
        <aside
          className={css.panel}
          data-testid="fit-sheet-schedule"
          style={{
            width: panelW,
            left: box.boxLeft + box.boxW - panelW - inset,
            top: box.boxTop + inset,
            bottom: scrimBot + inset,
          }}
        >
          <div className={css.panelHead} data-testid="fit-sheet-title-block">
            <div style={{ minWidth: 0 }}>
              <p className={css.brand}>Curtis &amp; Co</p>
              <p className={css.addr}>{titleBlock?.address ?? address}</p>
              <p className={css.titleSource} data-testid="fit-sheet-cadastral">
                {titleBlock?.sourceLabel ?? "Indicative parcel"}
                {titleBlock?.parcelRef
                  ? ` · ${titleBlock.parcelRef.includes("\\") || titleBlock.parcelRef.includes("/") ? "SPI" : "PFI"} ${titleBlock.parcelRef}`
                  : null}
              </p>
              {titleBlock?.councilLabel ? (
                <p className={css.titleCouncil}>{titleBlock.councilLabel}</p>
              ) : null}
            </div>
            <span className={css.northRose} title="True north" aria-hidden>
              <svg viewBox="0 0 24 28" width="22" height="26">
                <polygon points="12,2 15,14 12,12 9,14" fill="#1a1a1a" />
                <line
                  x1="12"
                  y1="12"
                  x2="12"
                  y2="26"
                  stroke="#1a1a1a"
                  strokeWidth="1.2"
                />
                <text
                  x="12"
                  y="11"
                  textAnchor="middle"
                  fontSize="6"
                  fontFamily="IBM Plex Mono, monospace"
                  fill="#1a1a1a"
                >
                  N
                </text>
              </svg>
            </span>
          </div>

          <div className={css.section}>
            <p className={css.kicker}>Site schedule</p>
            {(
              [
                [
                  "Lot area",
                  `${areas.lotAreaM2.toLocaleString("en-AU", {
                    maximumFractionDigits: 2,
                  })} m²`,
                ],
                [
                  "Existing dwelling",
                  `${areas.buildingAreaM2.toFixed(2)} m²`,
                ],
                [
                  "Outdoor area",
                  `${areas.outdoorAreaM2.toFixed(2)} m²`,
                ],
                ["Site coverage", `${areas.siteCoveragePct}%`],
                [
                  "Boundary perimeter",
                  `${schedule.boundaryPerimeterM.toFixed(2)}\u00A0lm`,
                ],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className={css.row}>
                <span>{k}</span>
                <span className={css.mono}>{v}</span>
              </div>
            ))}
          </div>

          {/* On-canvas outside dims own B#/F# callouts — schedule keeps areas + legend. */}
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
            <p className={css.notesBody} data-testid="fit-sheet-notes">
              {titleBlock?.notesLine ??
                "Vicmap cadastral base · confirm title. Dimensions in metres — working drawing, indicative only."}{" "}
              B# = boundary · F# = dwelling envelope. Not for construction.
            </p>
            <div className={css.notesMeta}>
              <span data-testid="fit-sheet-scale-stamp">
                {SHEET_SCALE_STEPS.includes(scaleDenom)
                  ? scaleTxt
                  : `${scaleTxt} (Not to scale) — Working drawing indicative only`}
              </span>
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
            left: box.boxLeft + inset,
            bottom: scrimBot + inset,
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
    </div>
  );
}
