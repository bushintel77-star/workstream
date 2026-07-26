"use client";

import { useEffect, useMemo, useState } from "react";
import type { ArchitecturalTitleBlock } from "@workstream/domain";
import {
  buildWorkableSiteSchedule,
  formatScheduleAreaM2,
  resolveSiteAreaDisplay,
  SHEET_INNER_MARGIN,
  SHEET_PANEL_GAP,
  SHEET_SCALE_STEPS,
  SHEET_TITLE_STRIP_H,
  sheetBoxFor,
  titlePanelWidth,
  type PaperSize,
  type PctPoint,
  type SheetScaleDenom,
} from "../../geometry";
import {
  elevationLookPair,
  elevationLookProjector,
  type ElevationLook,
} from "@workstream/domain";
import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import { SEMANTIC_LIGHT, mixOnHex } from "../../../../../styles/colorTokens";
import type { IrrigationZone, PresentationPack } from "@workstream/contracts";
import { widgetsInSlot } from "@workstream/domain";
import { WeatherIcon } from "../stickyMeta/WeatherIcon";
import type { EnvWeatherDay } from "../stickyMeta/envLiveMeta";
import { resolveEnvWeatherCondition } from "../stickyMeta/envLiveMeta";
import { SheetWidgetStack } from "./SheetWidgetStack";
import { buildSheetWidgetContext } from "./sheetWidgetContext";
import composeCss from "./sheetCompose.module.css";
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
  /** Cardinal look for stacked elevations (primary + opposite pair). */
  elevLook?: ElevationLook;
  issuedLabel?: string;
  /** Architectural print scale 1:N — discrete snap ladder. */
  scaleDenom?: SheetScaleDenom;
  onScaleDenom?: (n: SheetScaleDenom) => void;
  /** Live Vicmap cadastral title block for the selected address. */
  titleBlock?: ArchitecturalTitleBlock | null;
  /** Doc-control stamp from the latest share revision. */
  shareStamp?: string | null;
  /** Today’s Open-Meteo day — tiny weather pip in the title strip. */
  weatherDay?: EnvWeatherDay | null;
  /** Presentation product pack — widgets around the live plot. */
  presentationPack?: PresentationPack | null;
  quoteTotalInclGst?: number;
  tier1?: boolean;
  /** Live irrigation / services zones for zone_summary honesty. */
  irrigationZones?: IrrigationZone[];
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

function alongPct(
  p: { x: number; y: number },
  axis: "x" | "y",
  reverse: boolean,
): number {
  const raw = axis === "x" ? p.x : p.y;
  return reverse ? 100 - raw : raw;
}

function buildElevProfile(
  look: ElevationLook,
  boundary: PctPoint[],
  building: PctPoint[],
  items: StudioItem[],
  scaleM: number,
  rowH: number,
): ElevProfile {
  const proj = elevationLookProjector(look);
  const coords = boundary.map((p) => alongPct(p, proj.axis, proj.reverse));
  const minC = Math.min(...coords);
  const maxC = Math.max(...coords);
  const span = Math.max(1, maxC - minC);
  const widthM = (span / 100) * scaleM;

  const bCoords = building.map((p) => alongPct(p, proj.axis, proj.reverse));
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
  const usable = rowH - 28;
  const bH = (eaveH / maxHM) * usable;

  const elevItems = items
    .filter((i) => BY_TYPE[i.t].heightM)
    .map((it) => {
      const d = BY_TYPE[it.t];
      const c = alongPct({ x: it.x, y: it.y }, proj.axis, proj.reverse);
      const x = ((c - minC) / span) * 96 + 2;
      const hm = (d.heightM ?? 1) * it.scale;
      return {
        x,
        wPx: it.ghost ? 4 : 5,
        hPx: (hm / maxHM) * usable,
        fill: it.ghost
          ? mixOnHex(SEMANTIC_LIGHT.textPrimary, 5, SEMANTIC_LIGHT.canvas)
          : mixOnHex(SEMANTIC_LIGHT.textPrimary, 10, SEMANTIC_LIGHT.canvas),
        stroke: it.ghost
          ? SEMANTIC_LIGHT.textMuted
          : SEMANTIC_LIGHT.textPrimary,
        dash: it.ghost ? "dashed" : "solid",
      };
    });

  return {
    label: proj.label.toUpperCase(),
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
  elevLook = "N",
  issuedLabel,
  scaleDenom = 100,
  onScaleDenom,
  titleBlock = null,
  shareStamp = null,
  weatherDay = null,
  presentationPack = null,
  quoteTotalInclGst = 0,
  tier1 = false,
  irrigationZones = [],
}: Props) {
  const [pulse, setPulse] = useState(false);
  const weatherCondition = resolveEnvWeatherCondition(weatherDay, 45);
  const sheetWidgetContext = useMemo(
    () => buildSheetWidgetContext({ items, irrigationZones }),
    [items, irrigationZones],
  );
  const weatherTemp =
    weatherDay?.temp_max_c != null && Number.isFinite(weatherDay.temp_max_c)
      ? Math.round(weatherDay.temp_max_c)
      : null;

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

  /** Shared policy with Live Measures / CAD — sanitize absurd dwelling rings. */
  const areas = useMemo(
    () =>
      resolveSiteAreaDisplay({
        schedule,
        cadastralLotM2: titleBlock?.lotAreaM2,
        cadastralHouseM2: titleBlock?.houseAreaM2,
      }),
    [schedule, titleBlock?.lotAreaM2, titleBlock?.houseAreaM2],
  );

  const legend = useMemo(() => legendLines(items, scaleM), [items, scaleM]);
  /* A4 portrait: title block reflows to a full-width bottom strip so the
     plot keeps the whole paper width (matches plotBoxFor reservation). */
  const a4Strip = paper === "a4";
  const panelW = a4Strip ? 0 : titlePanelWidth(box.boxW);
  const showPanel = a4Strip ? box.boxW >= 260 : panelW > 0;
  const scrimBot = Math.max(0, boardH - box.boxTop - box.boxH);
  const inset = SHEET_INNER_MARGIN;

  const elevProfiles = useMemo(() => {
    if (!showElevations) return [];
    const rowH = 56;
    const primary = elevLook;
    const secondary = elevationLookPair(elevLook);
    return [
      buildElevProfile(primary, boundary, building, items, scaleM, rowH),
      buildElevProfile(secondary, boundary, building, items, scaleM, rowH),
    ];
  }, [showElevations, elevLook, boundary, building, items, scaleM]);

  const elevPanelOn = elevProfiles.length > 0 && box.boxW >= 280;
  const elevPanelW = Math.max(
    140,
    box.boxW -
      inset * 2 -
      (showPanel && !a4Strip ? panelW + SHEET_PANEL_GAP : 0),
  );
  const elevPanelH = 56 * 2 + 34;
  /* Elevations sit above the A4 title strip when both are on. */
  const elevBottomExtra = a4Strip
    ? SHEET_TITLE_STRIP_H + SHEET_PANEL_GAP
    : 0;

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
        className={`${css.frame}${pulse ? ` ${css.framePulse}` : ""}${
          presentationPack?.theme === "ink"
            ? ` ${composeCss.frameThemeInk}`
            : ""
        }${
          presentationPack?.theme === "blush"
            ? ` ${composeCss.frameThemeBlush}`
            : ""
        }`}
        data-testid="fit-sheet-frame"
        data-paper={paper}
        data-scale={scaleTxt}
        data-sheet-theme={presentationPack?.theme ?? "parchment"}
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
          className={`${css.panel}${a4Strip ? ` ${css.panelStrip}` : ""}`}
          data-testid="fit-sheet-schedule"
          style={
            a4Strip
              ? {
                  left: box.boxLeft + inset,
                  width: box.boxW - inset * 2,
                  height: SHEET_TITLE_STRIP_H,
                  bottom: scrimBot + inset,
                }
              : {
                  width: panelW,
                  left: box.boxLeft + box.boxW - panelW - inset,
                  top: box.boxTop + inset,
                  bottom: scrimBot + inset,
                }
          }
        >
          <div className={css.panelHead} data-testid="fit-sheet-title-block">
            <div style={{ minWidth: 0 }}>
              <p className={css.brand}>Curtis &amp; Co</p>
              <p className={css.addr}>{titleBlock?.address ?? address}</p>
              {presentationPack ? (
                <SheetWidgetStack
                  pack={presentationPack}
                  slot="title_meta"
                  quoteTotalInclGst={quoteTotalInclGst}
                  tier1={tier1}
                  context={sheetWidgetContext}
                />
              ) : null}
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
            <div className={css.titleMeta}>
              {weatherDay ? (
                <span
                  className={css.weatherPip}
                  data-testid="fit-sheet-weather"
                  title={
                    weatherTemp != null
                      ? `Forecast · ${weatherTemp}° max`
                      : "Forecast"
                  }
                >
                  <WeatherIcon condition={weatherCondition} size={14} />
                  {weatherTemp != null ? (
                    <span className={css.weatherTemp}>{weatherTemp}°</span>
                  ) : null}
                </span>
              ) : null}
              <span className={css.northRose} title="True north" aria-hidden>
                <svg viewBox="0 0 22 30" width="19" height="26">
                  <text
                    x="11"
                    y="6.4"
                    textAnchor="middle"
                    fontSize="6.5"
                    fontFamily="var(--font-serif)"
                    fontWeight="600"
                    fill="#1a1a1a"
                  >
                    N
                  </text>
                  {/* Surveyor's needle: solid north half, open south half. */}
                  <polygon
                    points="11,9.5 14,20 11,17 8,20"
                    fill="#1a1a1a"
                  />
                  <polygon
                    points="11,17 14,20 11,25.5 8,20"
                    fill="none"
                    stroke="#1a1a1a"
                    strokeWidth="0.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
          </div>

          <div className={css.section}>
            <p className={css.kicker}>Site schedule</p>
            {(
              [
                ["Lot area", `${formatScheduleAreaM2(areas.lotAreaM2)} m²`],
                [
                  "Existing dwelling",
                  `${formatScheduleAreaM2(areas.buildingAreaM2)} m²`,
                ],
                [
                  "Outdoor area",
                  `${formatScheduleAreaM2(areas.outdoorAreaM2)} m²`,
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

          {presentationPack &&
          widgetsInSlot(presentationPack, "side_stack").length > 0 ? (
            <div className={`${css.section} ${css.presentationSection}`}>
              <p className={css.kicker}>Presentation</p>
              <SheetWidgetStack
                pack={presentationPack}
                slot="side_stack"
                quoteTotalInclGst={quoteTotalInclGst}
                tier1={tier1}
                context={sheetWidgetContext}
              />
            </div>
          ) : null}

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
            {presentationPack ? (
              <SheetWidgetStack
                pack={presentationPack}
                slot="footer_band"
                quoteTotalInclGst={quoteTotalInclGst}
                tier1={tier1}
                context={sheetWidgetContext}
              />
            ) : null}
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
              {shareStamp ? (
                <span data-testid="fit-sheet-share-stamp">{shareStamp}</span>
              ) : null}
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
            bottom: scrimBot + inset + elevBottomExtra,
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
