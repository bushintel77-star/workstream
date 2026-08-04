"use client";

import { useEffect, useMemo, useState } from "react";
import type { ArchitecturalTitleBlock } from "@workstream/domain";
import {
  buildWorkableSiteSchedule,
  formatScheduleAreaM2,
  resolveSiteAreaDisplay,
  SHEET_PANEL_GAP,
  SHEET_SCALE_STEPS,
  SHEET_TITLE_STRIP_H,
  sheetBoxFor,
  sheetInnerMarginForTemplate,
  titlePanelWidth,
  type PaperSize,
  type PctPoint,
  type SheetScaleDenom,
} from "../../geometry";
import {
  elevationLookPair,
  elevationLookProjector,
  preferBrochureElevLook,
  type ElevationLook,
} from "@workstream/domain";
import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import {
  elevationBars,
  elevationBuildingBox,
  elevationCeilingM,
  elevationParcelWidthM,
  elevationSpan,
  type ElevationBar,
} from "../elevation/elevationBars";
import type { ElevBox } from "../elevation/gardenElevationGeometry";
import { GardenElevationGlyph } from "../elevation/GardenElevationGlyph";
import { SEMANTIC_LIGHT, mixOnHex } from "../../../../../styles/colorTokens";
import type { IrrigationZone, PresentationPack } from "@workstream/contracts";
import { widgetsInSlot } from "@workstream/domain";
import { WeatherIcon } from "../stickyMeta/WeatherIcon";
import type { EnvWeatherDay } from "../stickyMeta/envLiveMeta";
import { resolveEnvWeatherCondition } from "../stickyMeta/envLiveMeta";
import { SheetWidgetStack } from "./SheetWidgetStack";
import { SheetFurniture } from "./SheetFurniture";
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
  building: ElevBox;
  bars: ElevationBar[];
};

/**
 * Elevation strip geometry, in px — the SVG viewBox is sized 1 unit = 1 px so
 * the silhouettes (trunks, deck posts, clip ticks) render undistorted inside
 * each bar. Values track `.elevRow` / `.elevGround` in fitSheet.module.css.
 */
const SHEET_ROW_H = 56;
/** `.elevStack` horizontal padding. */
const SHEET_ROW_PAD_X = 14;
/** Right-hand reserve for the site-width readout (`.elevGround` right). */
const SHEET_WIDTH_LABEL_W = 36;
/** Drawable height above the datum. */
const SHEET_PLOT_H = SHEET_ROW_H - 28;
/** `.elevGround` starts 2% in. */
const SHEET_PLOT_INSET = 0.98;
/** Indicative bar widths (px) — see ElevationBarWidthMode for why. */
const SHEET_BAR_WIDTH = { ghost: 4, wide: 6, narrow: 5 } as const;

function sheetPlotW(panelW: number): number {
  const row = panelW - SHEET_ROW_PAD_X * 2;
  return Math.max(40, row * SHEET_PLOT_INSET - SHEET_WIDTH_LABEL_W);
}

/**
 * One elevation row.
 *
 * Heights, silhouette families and callout names come from the shared
 * `elevationBars` layout, so the sheet and the elevation board cannot disagree
 * about how tall a placement stands or what it looks like. Bar widths stay
 * indicative here: the strip squeezes the whole datum into 28 px.
 */
function buildElevProfile(
  look: ElevationLook,
  boundary: PctPoint[],
  building: PctPoint[],
  items: StudioItem[],
  scaleM: number,
  plotW: number,
): ElevProfile {
  const plot = { x0: 0, w: plotW, groundY: SHEET_PLOT_H, h: SHEET_PLOT_H };
  const ceilingM = elevationCeilingM(items);
  return {
    label: elevationLookProjector(look).label.toUpperCase(),
    widthM: elevationParcelWidthM(elevationSpan(boundary, look).span, scaleM),
    building: elevationBuildingBox(building, {
      look,
      boundary,
      plot,
      ceilingM,
      fallbackSpan: { from: 0.29, to: 0.55 },
    }),
    bars: elevationBars(items, {
      look,
      boundary,
      scaleM,
      plot,
      ceilingM,
      fallbackWidth: SHEET_BAR_WIDTH,
      widthMode: "indicative",
    }),
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
  const inset = sheetInnerMarginForTemplate(presentationPack?.template_id);

  const elevPanelW = Math.max(
    140,
    box.boxW -
    inset * 2 -
    (showPanel && !a4Strip ? panelW + SHEET_PANEL_GAP : 0),
  );
  const elevPlotW = sheetPlotW(elevPanelW);

  const elevProfiles = useMemo(() => {
    if (!showElevations) return [];
    const brochure =
      presentationPack?.template_id === "curtis-client-brochure" ||
      presentationPack?.template_id === "curtis-dark-concept";
    const primary = brochure
      ? preferBrochureElevLook(building)
      : elevLook;
    const secondary = elevationLookPair(primary);
    return [
      buildElevProfile(primary, boundary, building, items, scaleM, elevPlotW),
      buildElevProfile(secondary, boundary, building, items, scaleM, elevPlotW),
    ];
  }, [
    showElevations,
    elevLook,
    boundary,
    building,
    items,
    scaleM,
    elevPlotW,
    presentationPack?.template_id,
  ]);

  const elevPanelOn = elevProfiles.length > 0 && box.boxW >= 280;
  const technicalFurniture =
    (presentationPack?.pen ?? "technical") === "technical";
  const elevPanelH = SHEET_ROW_H * 2 + 34;
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
        className={`${css.frame}${pulse ? ` ${css.framePulse}` : ""}${presentationPack?.theme === "ink"
          ? ` ${composeCss.frameThemeInk}`
          : ""
          }${presentationPack?.theme === "deep"
            ? ` ${composeCss.frameThemeDeep}`
            : ""
          }`}
        data-testid="fit-sheet-frame"
        data-paper={paper}
        data-scale={scaleTxt}
        data-sheet-theme={presentationPack?.theme ?? "parchment"}
        data-sheet-pen={presentationPack?.pen ?? "technical"}
        data-sheet-atmosphere={presentationPack?.atmosphere ?? "graphite"}
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
                    fill={SEMANTIC_LIGHT.textPrimary}
                  >
                    N
                  </text>
                  {/* Surveyor's needle: solid north half, open south half. */}
                  <polygon
                    points="11,9.5 14,20 11,17 8,20"
                    fill={SEMANTIC_LIGHT.textPrimary}
                  />
                  <polygon
                    points="11,17 14,20 11,25.5 8,20"
                    fill="none"
                    stroke={SEMANTIC_LIGHT.textPrimary}
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
            {areas.lotDisagreement?.mismatch ? (
              <div className={css.row} data-testid="lot-disagreement">
                <span>Title area</span>
                <span className={css.mono}>
                  {formatScheduleAreaM2(
                    areas.lotDisagreement.cadastralLotM2!,
                  )}{" "}
                  m²
                </span>
              </div>
            ) : null}
            {areas.lotDisagreement?.mismatch ? (
              <p className={css.notesLine}>
                Title lot area disagrees with drawn boundary — confirm parcel
                or re-trace.
              </p>
            ) : null}
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
                  <span className={css.mono} style={{ color: SEMANTIC_LIGHT.textMuted }}>
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
                "Vicmap cadastral base · confirm title. Dimensions in metres."}{" "}
              B# = boundary · F# = dwelling envelope.
            </p>
            <div className={css.notesMeta}>
              <span data-testid="fit-sheet-scale-stamp">
                {SHEET_SCALE_STEPS.includes(scaleDenom)
                  ? scaleTxt
                  : `${scaleTxt} (Not to scale)`}
              </span>
              {shareStamp ? (
                <span data-testid="fit-sheet-share-stamp">{shareStamp}</span>
              ) : null}
              <span>{issued}</span>
            </div>
            <SheetFurniture
              scaleM={scaleM ?? 20}
              frameWidthPx={box.boxW}
              technical={technicalFurniture}
            />
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
          {elevProfiles.map((pf, idx) => {
            const sectionId = String.fromCharCode(65 + (idx % 26));
            return (
              <div
                key={pf.label}
                className={css.elevRow}
                data-section-id={technicalFurniture ? sectionId : undefined}
                data-testid={
                  technicalFurniture
                    ? `fit-elev-section-${sectionId}`
                    : "fit-elev-concept"
                }
              >
                {technicalFurniture ? (
                  <span className={css.elevLabel}>
                    {sectionId}–{sectionId}′ · {pf.label}
                  </span>
                ) : (
                  <span className={css.elevLabel}>{pf.label}</span>
                )}
                {technicalFurniture ? (
                  <div className={css.elevGround} data-testid="fit-elev-datum">
                    <span className={css.elevDatumLabel}>RL 0.00</span>
                  </div>
                ) : (
                  <div className={css.elevGround} />
                )}
                {/* Silhouettes share the board's geometry. Untextured on
                    purpose: ElevationTextureDefs is mounted by the elevation
                    board, and duplicating those pattern ids in one document is
                    invalid — the glyph's flat token wash is the print look. */}
                <svg
                  className={css.elevProfile}
                  viewBox={`0 0 ${elevPlotW} ${SHEET_PLOT_H}`}
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <rect
                    x={pf.building.x}
                    y={pf.building.y}
                    width={pf.building.w}
                    height={pf.building.h}
                    fill={mixOnHex(
                      SEMANTIC_LIGHT.textPrimary,
                      5,
                      SEMANTIC_LIGHT.canvas,
                    )}
                    stroke={SEMANTIC_LIGHT.textPrimary}
                    strokeWidth={1.2}
                    vectorEffect="non-scaling-stroke"
                  />
                  {pf.bars.map((bar) => (
                    <GardenElevationGlyph
                      key={bar.item.id}
                      family={bar.family}
                      box={bar.box}
                      ghost={bar.item.ghost}
                      indicative={bar.indicative}
                    />
                  ))}
                </svg>
                <span className={css.elevWidth}>{pf.widthM.toFixed(1)} m</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
