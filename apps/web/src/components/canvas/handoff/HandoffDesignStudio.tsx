"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  BY_TYPE,
  MODE_TABS,
  PAINT_SWATCHES,
  type StudioItemType,
  type StudioMode,
} from "./studioCatalog";
import { useStudioState } from "./state/useStudioState";
import { resolveHandoffChrome } from "./state/handoffChrome";
import {
  allowAerialUnderlay,
  isDraftingPlate,
  resolveLiveAerial,
} from "./state/studioPlane";
import { CadPlanBoard } from "./features/cadPlan/CadPlanBoard";
import { DraftGridStudio } from "./features/gridStudio/DraftGridStudio";
import {
  loadGridStudioPrefs,
  saveGridStudioPrefs,
  type GridFormation,
  type GridInk,
} from "./geometry/gridStudio";
import { FitSheetOverlay } from "./features/fitSheet/FitSheetOverlay";
import { AiGhostReview } from "./features/aiGhosts/AiGhostReview";
import { LayersPanel } from "./features/layers/LayersPanel";
import { StudioCommandPalette } from "./features/commandPalette/StudioCommandPalette";
import { SunGrowthDock } from "./features/sunGrowth/SunGrowthDock";
import { UtilityDrawer } from "./features/utilityDrawer/UtilityDrawer";
import { PermitTodosPanel } from "./features/permitTodos/PermitTodosPanel";
import { QuoteSurface } from "./features/tier1/QuoteSurface";
import { ElevationBoard } from "./features/elevation/ElevationBoard";
import {
  TraceOverlay,
  currentTraceCompletion,
} from "./features/trace/TraceOverlay";
import { MeasureOverlay } from "./features/measure/MeasureOverlay";
import { isStickyDraftTool } from "./features/measure/measureCancel";
import { AerialSlot } from "./features/aerial/AerialSlot";
import { ShadeGridOverlay } from "./features/shade/ShadeGridOverlay";
import { SketchBoard } from "./features/sketch/SketchBoard";
import { rasterizeStrokesToPng } from "./features/sketch/rasterizeStrokes";
import { SurveyAnnotationLayer } from "./features/survey/SurveyAnnotationLayer";
import { SurveyChecklist } from "./features/survey/SurveyChecklist";
import { SiteSwitcher } from "./features/sites/SiteSwitcher";
import { AmbientRibbon } from "./features/ambient/AmbientRibbon";
import { NicheToolCarousel } from "./features/kitInventory/NicheToolCarousel";
import { KitAssetDock } from "./features/kitInventory/KitAssetDock";
import { SwatchTray } from "./features/swatchTray/SwatchTray";
import {
  nicheToolsForZone,
  zoneNicheActiveId,
  type NicheTool,
} from "./features/kitInventory/nicheTools";
import { LiveMeasuresRail } from "./features/liveMeasures/LiveMeasuresRail";
import { PointerMarkSettings } from "./features/pointer/PointerMarkSettings";
import {
  loadPointerMarkId,
  savePointerMarkId,
  type PointerMarkId,
} from "./features/pointer/pointerMarks";
import { resolveStudioCursor } from "./features/pointer/resolveStudioCursor";
import { clampToCanvasMargin } from "./features/reach/marginSummon";
import { SelectionRing } from "./features/selectionRing/SelectionRing";
import { ExistTreeInspector } from "./features/selectionRing/ExistTreeInspector";
import { ZoneOverlay } from "./features/zones/ZoneOverlay";
import { PreemptiveHorizon } from "./features/horizon/PreemptiveHorizon";
import { HorizonMarkers } from "./features/horizon/HorizonMarkers";
import { ShareSurface } from "./features/share/ShareSurface";
import { FloraRing } from "./features/flora/FloraRing";
import { VolumetricIsolith } from "./features/isolith/VolumetricIsolith";
import { AmbientBudgetMargin } from "./features/trade/AmbientBudgetMargin";
import { TradeSkuTag } from "./features/trade/TradeSkuTag";
import { ITEM_LAYER } from "./state/studioTypes";
import { boardScaleM } from "./features/ground/groundMetrics";
import {
  solveLiveTradeEstimate,
  tradeTagForItem,
  type ArchitecturalTitleBlock,
} from "@workstream/domain";
import type {
  CatalogPlacement,
  CanvasStroke,
  DesignSiteFrame,
  IrrigationZone,
} from "@workstream/contracts";
import {
  plotBoxFor,
  sheetBoxFor,
  titlePanelWidth,
} from "./geometry";
import {
  zoomByKeyStep,
  zoomByRibbonDelta,
  zoomFromWheel,
} from "./geometry/canvasZoom";
import {
  formalizeSketchToCadAction,
  lookupCadastralTitleAction,
} from "../../../app/actions";
import css from "./handoffStudio.module.css";

type Props = {
  projectId: string;
  projectAddress: string;
  projectLat?: number | null;
  projectLng?: number | null;
  aerialUri?: string | null;
  areaM2?: number | null;
  initialMode?: StudioMode;
  initialPlacements?: CatalogPlacement[];
  initialStrokes?: CanvasStroke[];
  initialSiteFrame?: DesignSiteFrame | null;
  initialIrrigationZones?: IrrigationZone[];
  hasQuote?: boolean;
  quotePortalUri?: string | null;
  initialTitleBlock?: ArchitecturalTitleBlock | null;
};

/**
 * Design Studio v4/v5 shell — composes feature modules on `useStudioState`.
 * %‑coord aerial drafting board (not MapLibre / Vicmap title chrome).
 */
export function HandoffDesignStudio({
  projectId,
  projectAddress,
  projectLat = null,
  projectLng = null,
  aerialUri = null,
  areaM2 = 230.82,
  initialMode = "cad",
  initialPlacements = [],
  initialStrokes = [],
  initialSiteFrame = null,
  initialIrrigationZones = [],
  hasQuote = false,
  quotePortalUri = null,
  initialTitleBlock = null,
}: Props) {
  const fallbackOutdoor = areaM2 ?? 230.82;
  const studio = useStudioState({
    projectId,
    address: projectAddress,
    aerialUri,
    outdoorM2: fallbackOutdoor,
    initialMode: MODE_TABS.includes(initialMode as StudioMode)
      ? initialMode
      : "cad",
    initialPlacements,
    initialStrokes,
    initialSiteFrame,
    initialIrrigationZones,
  });
  const [gridPreviewFormation, setGridPreviewFormation] =
    useState<GridFormation | null>(null);
  const [gridPreviewInk, setGridPreviewInk] = useState<GridInk | null>(null);

  const {
    ui,
    ai,
    compliance,
    estimate,
    estimateSettling,
    workableOutdoorM2,
    siteSchedule,
    acceptHorizonCard,
  } = studio;
  /** Prefer Turf workable outdoor; fall back to project / seed area. */
  const outdoor = workableOutdoorM2 > 0 ? workableOutdoorM2 : fallbackOutdoor;
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState({ w: 960, h: 640 });
  const [quotePersisted, setQuotePersisted] = useState(hasQuote);
  const [portalUri, setPortalUri] = useState<string | null>(quotePortalUri);
  const [titleBlock, setTitleBlock] = useState<ArchitecturalTitleBlock | null>(
    initialTitleBlock,
  );
  /**
   * Sticky instrument home — empty canvas margin only (off the lot drawing).
   * Does not follow selection; default parks in the left gutter.
   */
  const [anchorPct, setAnchorPct] = useState<{ x: number; y: number }>({
    x: 12,
    y: 42,
  });
  /** Instruments open only when summoned (margin click / hub), not on select. */
  const [instrumentsSummoned, setInstrumentsSummoned] = useState(false);
  const [pointerMarkId, setPointerMarkId] = useState<PointerMarkId>("spade");
  /** Settings hover preview — persists only on click. */
  const [pointerMarkPreview, setPointerMarkPreview] =
    useState<PointerMarkId | null>(null);
  const [pointerSettingsOpen, setPointerSettingsOpen] = useState(false);
  /** Handle hover from CadPlanBoard — move / add / paint affordances. */
  const [boardCursor, setBoardCursor] = useState<
    "default" | "move" | "add" | "paint" | null
  >(null);
  /** Target settle-flash after a Paint apply — presentational confirmation only. */
  const [paintFlashId, setPaintFlashId] = useState<string | null>(null);
  const paintFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashPaintTarget = (id: string) => {
    setPaintFlashId(id);
    if (paintFlashTimer.current) clearTimeout(paintFlashTimer.current);
    paintFlashTimer.current = setTimeout(() => setPaintFlashId(null), 460);
  };
  /** Eyedropper — next canvas click loads that element's style into the swatch. */
  const [eyedropArmed, setEyedropArmed] = useState(false);
  const pickStyle = (t: StudioItemType) => {
    setEyedropArmed(false);
    studio.setUi({ paintSwatch: t, tool: "paint" });
  };

  useEffect(() => {
    setPointerMarkId(loadPointerMarkId());
  }, []);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setBoardSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    setBoardSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /** Sheet box geometry for print — crop viewport to the A3/A4 frame. */
  const printSheet = useMemo(() => {
    if (!ui.frameOn) return null;
    const sheet = sheetBoxFor(boardSize.w, boardSize.h, ui.paper);
    return {
      left: sheet.boxLeft,
      top: sheet.boxTop,
      w: sheet.boxW,
      h: sheet.boxH,
      boardW: boardSize.w,
      boardH: boardSize.h,
      paper: ui.paper,
    };
  }, [ui.frameOn, ui.paper, boardSize.w, boardSize.h]);

  /**
   * Browser print: set @page to the active paper size and mark the document
   * so global CSS can hide app chrome outside the studio.
   */
  useEffect(() => {
    if (!printSheet) return;
    const STYLE_ID = "ws-fit-sheet-print-page";
    const onBefore = () => {
      let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
      if (!el) {
        el = document.createElement("style");
        el.id = STYLE_ID;
        document.head.appendChild(el);
      }
      el.textContent =
        printSheet.paper === "a4"
          ? "@page { size: A4 portrait; margin: 8mm; }"
          : "@page { size: A3 landscape; margin: 8mm; }";
      document.documentElement.dataset.wsPrinting = "1";
    };
    const onAfter = () => {
      document.getElementById(STYLE_ID)?.remove();
      delete document.documentElement.dataset.wsPrinting;
    };
    window.addEventListener("beforeprint", onBefore);
    window.addEventListener("afterprint", onAfter);
    return () => {
      window.removeEventListener("beforeprint", onBefore);
      window.removeEventListener("afterprint", onAfter);
      onAfter();
    };
  }, [printSheet]);

  /**
   * Infinite-feel canvas zoom — wheel / trackpad / pinch over the board.
   * Active on Survey / Sketch / CAD and on the A3/A4 fit sheet (world zoom).
   * Shift+wheel on the fit sheet changes architectural print scale (1:N) —
   * see FitSheetOverlay.
   */
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const planMode =
      ui.mode !== "elevation" && ui.mode !== "quote" && ui.mode !== "share";
    if (!planMode) return;
    const onWheel = (e: WheelEvent) => {
      // Fit sheet: Shift+wheel is reserved for 1:N print scale.
      if (ui.frameOn && e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [data-no-canvas-zoom]")) {
        return;
      }
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const focusX = Math.max(
        0,
        Math.min(100, ((e.clientX - r.left) / Math.max(1, r.width)) * 100),
      );
      const focusY = Math.max(
        0,
        Math.min(100, ((e.clientY - r.top) / Math.max(1, r.height)) * 100),
      );
      studio.setUi({
        focusX: Number(focusX.toFixed(2)),
        focusY: Number(focusY.toFixed(2)),
        zoom: zoomFromWheel(ui.zoom, e.deltaY),
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [studio, ui.frameOn, ui.mode, ui.zoom]);

  /** Restore micro grid studio prefs for this project session. */
  useEffect(() => {
    const prefs = loadGridStudioPrefs(projectId);
    if (!prefs) return;
    studio.setUi({
      ...(prefs.formation ? { gridFormation: prefs.formation } : {}),
      ...(prefs.ink ? { gridInk: prefs.ink } : {}),
      ...(prefs.grain ? { gridGrain: prefs.grain } : {}),
      ...(prefs.snap != null ? { gridSnap: prefs.snap } : {}),
    });
    // once per project mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  /**
   * Fit to screen by default — outdoor garden remnant on Survey / Sketch / CAD
   * (and again when opening the fit sheet). Infinite zoom remains available.
   */
  const outdoorFitKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (ui.focusOn || ui.clientView) return;
    if (
      ui.mode !== "survey" &&
      ui.mode !== "sketch" &&
      ui.mode !== "cad"
    ) {
      outdoorFitKeyRef.current = null;
      return;
    }
    const key = `${ui.mode}:${ui.siteIdx}:frame=${ui.frameOn ? 1 : 0}`;
    if (outdoorFitKeyRef.current === key) return;
    outdoorFitKeyRef.current = key;
    studio.fitOutdoorView();
  }, [ui.mode, ui.siteIdx, ui.frameOn, ui.focusOn, ui.clientView, studio]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        studio.setUi({ cmdOpen: !ui.cmdOpen });
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) studio.redo();
        else studio.undo();
        return;
      }
      if (typing || ui.cmdOpen) return;

      if (ui.tool === "trace" && ui.drawPoly) {
        if (e.key === "Tab") {
          const done = currentTraceCompletion(
            ui.drawPoly,
            ui.drawCursor,
            ui.locked,
          );
          if (done) {
            e.preventDefault();
            studio.finishTrace(done);
            return;
          }
        }
        if (e.key === "Enter" && ui.drawPoly.length >= 3) {
          e.preventDefault();
          studio.finishTrace(ui.drawPoly);
          return;
        }
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          studio.popTracePoint();
          return;
        }
      }

      if (e.key === "Escape") {
        if (ui.floraSession) {
          studio.dismissFlora();
          return;
        }
        if (ui.drawPoly) {
          studio.cancelTrace();
          return;
        }
        // CAD practice: Esc cancels sticky draft tools → pan (KiCad / Fusion).
        if (isStickyDraftTool(ui.tool)) {
          e.preventDefault();
          studio.setTool("pan");
          setInstrumentsSummoned(false);
          studio.setUi({
            factorsOpen: false,
            ghostReviewOpen: false,
            layersOpen: false,
            cmdOpen: false,
            addOpen: false,
            sitesOpen: false,
            coachOpen: false,
          });
          return;
        }
        if (ui.selectedId) {
          e.preventDefault();
          studio.setSelection(null, []);
          return;
        }
        studio.setUi({
          factorsOpen: false,
          ghostReviewOpen: false,
          layersOpen: false,
          cmdOpen: false,
          addOpen: false,
          sitesOpen: false,
          coachOpen: false,
          utilityPanel: null,
        });
        setPointerSettingsOpen(false);
        setInstrumentsSummoned(false);
        return;
      }
      if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        studio.setUi({ frameOn: !ui.frameOn });
        return;
      }
      /* Infinite zoom — + / = zoom in, - / _ zoom out (incl. fit sheet). */
      if (
        (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") &&
        ui.mode !== "elevation" &&
        ui.mode !== "quote" &&
        ui.mode !== "share"
      ) {
        e.preventDefault();
        studio.setUi({
          zoom: zoomByKeyStep(ui.zoom, e.key === "-" || e.key === "_" ? -1 : 1),
        });
        return;
      }
      if (
        (e.key.toLowerCase() === "a" || e.key === "Enter") &&
        ai.current &&
        !ui.drawPoly &&
        ui.tool !== "service" &&
        ui.tool !== "calib" &&
        ui.tool !== "level" &&
        ui.tool !== "trace" &&
        ui.tool !== "zone"
      ) {
        e.preventDefault();
        ai.accept(ai.current.id);
        return;
      }
      if (e.key.toLowerCase() === "r" && ai.current && !ui.drawPoly) {
        e.preventDefault();
        ai.reject(ai.current.id);
        return;
      }
      if (
        ui.selectedId &&
        !ui.drawPoly &&
        (e.key === "[" || e.key === "]")
      ) {
        e.preventDefault();
        studio.rotateSelectedClock(e.key === "]" ? 1 : -1);
        return;
      }
      if (
        !ui.selectedId &&
        !ui.drawPoly &&
        ai.pendingCount > 0 &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        e.preventDefault();
        ai.cycle(e.key === "ArrowRight" ? 1 : -1);
        return;
      }
      if (
        ui.selectedId &&
        !ui.drawPoly &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.2;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        studio.nudgeSelected(dx, dy);
        return;
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        ui.selectedId &&
        !ui.drawPoly
      ) {
        e.preventDefault();
        studio.deleteSelected();
      }

      /* Digit accelerators for Soft/Hard swatches (CAD hotkeys, not a hotbar). */
      if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const idx = Number(e.key) - 1;
        const selected = studio.items.find(
          (i) => i.id === ui.selectedId && !i.ghost,
        );
        const sw = PAINT_SWATCHES[idx];
        if (sw && ui.tool !== "zone") {
          e.preventDefault();
          if (selected) {
            studio.changeSelectedType(sw.t);
            return;
          }
          if (ui.tool === "paint" && !ui.frameOn) {
            studio.setUi({ paintSwatch: sw.t, tool: "paint" });
            return;
          }
          studio.setUi({
            armed: sw.t,
            tool: "add",
            addOpen: true,
            cmdOpen: false,
          });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studio, ui]);

  useEffect(() => {
    setQuotePersisted(hasQuote);
    setPortalUri(quotePortalUri);
  }, [hasQuote, quotePortalUri]);

  const planOn =
    ui.mode !== "elevation" && ui.mode !== "quote" && ui.mode !== "share";
  const chrome = resolveHandoffChrome({
    mode: ui.mode,
    tool: ui.tool,
    focusOn: ui.focusOn,
    frameOn: ui.frameOn,
    clientView: ui.clientView,
    foundationCleanse: ui.foundationCleanse,
    pendingGhosts: ai.pendingCount,
    shadeOn: ui.shadeOn,
    dataSummoned: ui.dataSummoned,
  });
  const titleLocked =
    ui.foundationCleanse || ui.boundarySource === "vicmap";
  const drawingHot = chrome.collapseUtility;
  const showDocks = chrome.utilityDrawer;
  /**
   * Dual-mode zoom — past the precision threshold, swap to the crisp skin so
   * fine CAD work never fights the soft shell. Instant (no animated morph).
   */
  const precisionOn =
    planOn &&
    !ui.frameOn &&
    !ui.focusOn &&
    !ui.clientView &&
    ui.zoom >= 2.2;
  /** Swatch furniture — persistent fills in plan CAD / Sketch only. */
  const swatchTrayOn =
    (ui.mode === "cad" || ui.mode === "sketch") &&
    !ui.frameOn &&
    !ui.focusOn &&
    !ui.clientView &&
    !ui.foundationCleanse;
  /** Draft AI surface only when chrome matrix allows (never Stage 1 / Fit). */
  const draftSurface = chrome.draftSurface;
  /** Prefer live project address; demo site switcher still re-queries Vicmap. */
  const displayAddress = studio.siteAddress || projectAddress;
  const scaleM = ui.boardWidthM ?? boardScaleM(ui.sheetScaleDenom);

  const [formalizing, setFormalizing] = useState(false);

  /**
   * Sketch → CAD: rasterize the raw freehand ink and run the Claude vision
   * pipeline server-side, then apply the returned CAD elements as reviewable
   * ghosts. Falls back to the local heuristic when the network / model fails.
   */
  const runFormalizeToCad = useCallback(async () => {
    if (formalizing) return;
    if (studio.strokes.length === 0) {
      studio.setMode("cad");
      studio.setUi({
        assistReply: "Sketch on the plan first — then formalize to CAD when ready.",
        councilTip: "Draw a path, bed, or canopy mark before translating to CAD.",
      });
      return;
    }
    setFormalizing(true);
    studio.setUi({
      assistReply: "Translating sketch to CAD with AI…",
      councilTip: null,
    });
    try {
      const raster = rasterizeStrokesToPng(
        studio.strokes,
        boardSize.w,
        boardSize.h,
      );
      if (!raster) {
        studio.interpretSketches();
        studio.setUi({
          councilTip:
            "Could not capture the sketch image — used quick geometry translation instead.",
        });
        return;
      }
      const res = await formalizeSketchToCadAction(projectId, {
        image_base64: raster.image_base64,
        mime_type: raster.mime_type,
        boundary: studio.boundary.map((p) => ({ x: p.x, y: p.y })),
        building: studio.building.map((p) => ({ x: p.x, y: p.y })),
        strokes: studio.strokes.map((s) => ({
          id: s.id,
          points: s.points.map((p) => ({ x: p.x, y: p.y })),
        })),
        scale_m: scaleM,
      });
      studio.applyCadSuggestions(res.suggestions, { source: res.source });
      if (res.source === "heuristic") {
        studio.setUi({
          councilTip:
            "AI vision unavailable — used quick geometry translation. Review ghosts before accepting.",
        });
      }
    } catch {
      // Network / model failure — keep the operator moving with the heuristic.
      studio.interpretSketches();
      studio.setUi({
        councilTip:
          "AI translation failed — used quick geometry translation. Review ghosts before accepting.",
      });
    } finally {
      setFormalizing(false);
    }
  }, [formalizing, studio, boardSize.w, boardSize.h, projectId, scaleM]);

  const requestMode = useCallback(
    (mode: (typeof MODE_TABS)[number]) => {
      if (ui.mode === "sketch" && mode === "cad" && studio.strokes.length > 0) {
        const alreadyHasSketchGhosts = studio.items.some(
          (i) => i.ghost && i.id.startsWith("ai-sketch-"),
        );
        if (!alreadyHasSketchGhosts) {
          void runFormalizeToCad();
          return;
        }
      }
      studio.setMode(mode);
    },
    [ui.mode, studio, runFormalizeToCad],
  );

  useEffect(() => {
    let cancelled = false;
    void lookupCadastralTitleAction(projectId, displayAddress)
      .then((block) => {
        if (!cancelled && block) setTitleBlock(block);
      })
      .catch(() => {
        /* keep last good title block */
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, displayAddress]);
  const draftingPlate = isDraftingPlate(ui.mode);
  const aerialOk = allowAerialUnderlay({
    mode: ui.mode,
    foundationCleanse: ui.foundationCleanse,
  });
  /** Single aerial paint path — Survey upload only; never CAD/Sketch/Stage 1. */
  const liveAerial = resolveLiveAerial({
    mode: ui.mode,
    foundationCleanse: ui.foundationCleanse,
    aerialSuppressed: ui.aerialSuppressed,
    aerialUri: ui.aerialUri,
    allowPlanUnderlay: draftingPlate && !ui.foundationCleanse,
  });
  const titleCueOnCad =
    (ui.foundationCleanse || titleLocked) && !ui.frameOn;
  const flaggedIds = new Set<string>(
    compliance.alerts.flatMap((a: { sourceIds: string[] }) => a.sourceIds),
  );

  const openHorizon = estimate.horizon.filter((h) => !ui.mitigated[h.id]);
  const actionHorizon = openHorizon.filter(
    (h) => h.kind === "drainage" || h.kind === "tpz" || h.kind === "engineer",
  );

  const trade = useMemo(
    () => solveLiveTradeEstimate({ report: estimate }),
    [estimate],
  );

  const tpzReadouts = compliance.alerts
    .filter((a) => a.code === "tpz")
    .map((a) => {
      const hardId = a.sourceIds.find((id) => {
        const it = studio.items.find((x) => x.id === id);
        return it && (it.t === "paving" || it.t === "deck");
      });
      const item = studio.items.find((x) => x.id === hardId);
      const pctMatch = a.title.match(/(\d+)%/);
      return {
        id: a.id,
        x: item?.x ?? 50,
        y: item?.y ?? 50,
        pct: pctMatch ? Number(pctMatch[1]) : 0,
        active: ui.hoverId === hardId || ui.selectedId === hardId,
      };
    });

  const layerChips = (
    [
      ["survey", "Survey"],
      ["boundary", "Boundary"],
      ["council", "Council"],
      ["vegetation", "Veg"],
    ] as const
  ).map(([key, label]) => ({
    key,
    label,
    count:
      key === "boundary"
        ? 2
        : studio.items.filter((i) => !i.ghost && ITEM_LAYER[i.t] === key)
            .length,
  }));

  const selectedLive =
    studio.items.find((i) => i.id === ui.selectedId && !i.ghost) ?? null;
  /** Any vectors / underlay / assets — kills barren-lot onboarding cue. */
  const hasGeometry =
    studio.items.some((i) => !i.ghost) ||
    studio.boundary.length >= 2 ||
    studio.building.length >= 2 ||
    Boolean(liveAerial) ||
    Boolean(ui.aerialUri) ||
    studio.easements.length > 0 ||
    studio.services.length > 0 ||
    titleLocked ||
    ui.boundarySource === "vicmap" ||
    ui.boundarySource === "seed";
  /** Tool armed or drawing in progress — not barren idle. */
  const canvasEngaged =
    ui.tool !== "pan" ||
    Boolean(ui.drawPoly && ui.drawPoly.length > 0) ||
    Boolean(ui.selectedId) ||
    ui.groupIds.length > 0 ||
    ui.addOpen ||
    ui.locked;
  /**
   * Instrument + inventory home — margin pin only (never lot core).
   */
  const instrumentAnchor = useMemo(() => {
    if (ui.drawPoly && ui.drawPoly.length > 0) {
      const last = ui.drawPoly[ui.drawPoly.length - 1]!;
      return clampToCanvasMargin(last.x, last.y);
    }
    return clampToCanvasMargin(anchorPct.x, anchorPct.y);
  }, [ui.drawPoly, anchorPct.x, anchorPct.y]);
  const selectedTradeTag =
    selectedLive && chrome.tradeMargin
      ? tradeTagForItem(trade, selectedLive.id)
      : null;

  useEffect(() => {
    if (!drawingHot) return;
    if (ui.utilityPanel != null || ui.coachOpen) {
      studio.setUi({ utilityPanel: null, coachOpen: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingHot]);

  const armType = (t: StudioItemType) => {
    studio.setUi({ armed: t, tool: "add", addOpen: true, cmdOpen: false });
  };

  const pinInstrumentAnchor = (x: number, y: number) => {
    setAnchorPct(clampToCanvasMargin(x, y));
  };

  const studioCursor = pointerMarkPreview
    ? resolveStudioCursor({
        markId: pointerMarkPreview,
        tool: "edit",
        mode: ui.mode,
        locked: false,
      })
    : resolveStudioCursor({
        markId: pointerMarkId,
        tool: ui.tool,
        mode: ui.mode,
        locked: ui.locked,
        frameOn: ui.frameOn,
        boardCursor:
          boardCursor && boardCursor !== "default" ? boardCursor : null,
      });

  const draftLabel =
    ai.status === "scanning"
      ? "Scanning"
      : ai.status === "assisting"
        ? "Assisting"
        : ai.pendingCount > 0
          ? `Review ${ai.pendingCount}`
          : "Ask AI";

  return (
    <div
      className={`${css.root}${ui.darkOn ? ` ${css.rootDark}` : ""}${ui.focusOn ? ` ${css.rootFocus}` : ""}${ui.clientView ? ` ${css.rootClient}` : ""}${precisionOn ? ` ${css.rootPrecision}` : ""}`}
      data-testid="handoff-design-studio"
      data-canvas-mode={ui.mode}
      data-studio-surface="handoff-v4"
      data-compliance={compliance.canvasSignal}
      data-fit-sheet={ui.frameOn ? "1" : "0"}
      data-paper={ui.paper}
      style={
        {
          ["--studio-zoom" as string]: String(ui.zoom),
          ...(printSheet
            ? {
                ["--ws-print-left" as string]: `${printSheet.left}px`,
                ["--ws-print-top" as string]: `${printSheet.top}px`,
                ["--ws-print-w" as string]: `${printSheet.w}px`,
                ["--ws-print-h" as string]: `${printSheet.h}px`,
                ["--ws-board-w" as string]: `${printSheet.boardW}px`,
                ["--ws-board-h" as string]: `${printSheet.boardH}px`,
              }
            : null),
        } as CSSProperties
      }
    >
      <header className={css.header} data-testid="canvas-studio-header">
        <div className={css.brandBlock}>
          <p className={css.brandName}>Curtis &amp; Co</p>
          <p className={css.address}>{displayAddress}</p>
        </div>

        <nav
          className={css.modes}
          aria-label="Design workflow"
          data-testid="canvas-mode-strip"
        >
          {MODE_TABS.map((m) => (
            <button
              key={m}
              type="button"
              className={`${css.modeBtn}${ui.mode === m ? ` ${css.modeBtnActive}` : ""}`}
              data-testid={`canvas-mode-${m}`}
              onClick={() => requestMode(m)}
            >
              {m[0]!.toUpperCase() + m.slice(1)}
            </button>
          ))}
        </nav>

        <div className={css.spacer} />

        {!ui.focusOn && !ui.clientView ? (
          <div className={css.meta} data-testid="header-cadastral-meta">
            {titleBlock?.metaLine ??
              `${studio.siteMeta} · ${Number(outdoor).toFixed(0)} m²`}
          </div>
        ) : null}

        {ui.frameOn && !ui.clientView ? (
          <div className={css.segment} data-testid="paper-size-control">
            {(["a3", "a4"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`${css.segmentBtn}${ui.paper === p ? ` ${css.segmentBtnActive}` : ""}`}
                onClick={() => studio.setPaper(p)}
              >
                {p.toUpperCase()}
              </button>
            ))}
            <button
              type="button"
              className={`${css.segmentBtn}${ui.sheetElevOn ? ` ${css.segmentBtnActive}` : ""}`}
              data-testid="sheet-elevations-toggle"
              onClick={() => studio.setUi({ sheetElevOn: !ui.sheetElevOn })}
              title="Elevations"
              aria-label="Elevations"
            >
              Elev
            </button>
          </div>
        ) : null}

        <div className={css.headerTools} role="toolbar" aria-label="Canvas tools">
          <button
            type="button"
            className={`${css.iconBtn}${pointerSettingsOpen ? ` ${css.iconBtnActive}` : ""}`}
            data-testid="pointer-settings-top"
            aria-label="Pointer settings"
            title="Pointer settings"
            onClick={() => setPointerSettingsOpen((o) => !o)}
          >
            <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.25" />
              <path
                d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className={`${css.iconBtn}${ui.foundationCleanse ? ` ${css.iconBtnActive}` : ""}`}
            data-testid="title-boundary-top"
            aria-label={
              ui.foundationCleanse ? "Close title boundary" : "Title boundary"
            }
            title="Title boundary"
            onClick={() => {
              if (ui.foundationCleanse) studio.exitStage1Foundation();
              else void studio.runStage1FoundationCleanse();
            }}
          >
            <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M2.5 3.5h11v9H2.5zM5 3.5v9M11 3.5v9M2.5 8h11"
                stroke="currentColor"
                strokeWidth="1.25"
              />
            </svg>
          </button>
          {ui.foundationCleanse || titleLocked ? (
            <button
              type="button"
              className={`${css.iconBtn}${ui.titleBoundaryLocked ? ` ${css.iconBtnActive}` : ""}`}
              data-testid="title-boundary-lock-top"
              aria-label={ui.titleBoundaryLocked ? "Unlock title" : "Lock title"}
              title={ui.titleBoundaryLocked ? "Unlock title" : "Lock title"}
              onClick={() =>
                studio.setTitleBoundaryLocked(!ui.titleBoundaryLocked)
              }
            >
              <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
                <rect
                  x="3.5"
                  y="7"
                  width="9"
                  height="6.5"
                  rx="1.2"
                  stroke="currentColor"
                  strokeWidth="1.25"
                />
                <path
                  d={
                    ui.titleBoundaryLocked
                      ? "M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"
                      : "M5.5 7V5.2a2.5 2.5 0 0 1 4.8-.8"
                  }
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            className={`${css.iconBtn}${ui.frameOn ? ` ${css.iconBtnActive}` : ""}`}
            data-testid="fit-sheet-top"
            aria-label="Fit sheet"
            title="Fit sheet"
            onClick={() => studio.setUi({ frameOn: !ui.frameOn })}
          >
            <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect
                x="3"
                y="2.5"
                width="10"
                height="11"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.25"
              />
              <path d="M9.5 2.5v11" stroke="currentColor" strokeWidth="1.25" />
            </svg>
          </button>
          {ui.frameOn ? (
            <button
              type="button"
              className={css.iconBtn}
              data-testid="fit-sheet-print"
              aria-label="Print fit sheet"
              title="Print fit sheet"
              onClick={() => window.print()}
            >
              <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M4 6V3.5h8V6M4 11.5h8V14H4v-2.5ZM3.5 6H12.5a1 1 0 0 1 1 1v3.5H2.5V7a1 1 0 0 1 1-1Z"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
          {!ui.focusOn && !ui.clientView ? (
            <>
              <button
                type="button"
                className={`${css.iconBtn}${ui.darkOn ? ` ${css.iconBtnActive}` : ""}`}
                data-testid="dark-canvas-top"
                aria-label="Dark canvas"
                title="Dark canvas"
                onClick={() => studio.setUi({ darkOn: !ui.darkOn })}
              >
                <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M9.2 2.4A5.5 5.5 0 1 0 13.6 10 4.2 4.2 0 0 1 9.2 2.4z"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {chrome.structureRail ? (
              <button
                type="button"
                className={`${css.iconBtn}${ui.layersOpen ? ` ${css.iconBtnActive}` : ""}`}
                data-testid="canvas-layers-top"
                aria-label="Layers"
                title="Layers"
                onClick={() => studio.setUi({ layersOpen: !ui.layersOpen })}
              >
                <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M2.5 5.2 8 2.8l5.5 2.4L8 7.6 2.5 5.2zm0 3.2L8 11l5.5-2.6M2.5 11.6 8 14.2l5.5-2.6"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              ) : null}
              <button
                type="button"
                className={css.iconBtn}
                data-testid="canvas-sites-top"
                aria-label="Sites"
                title="Sites"
                onClick={() => studio.setUi({ sitesOpen: !ui.sitesOpen })}
              >
                <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M8 13.5s4-3.4 4-6.2A4 4 0 1 0 4 7.3C4 10.1 8 13.5 8 13.5z"
                    stroke="currentColor"
                    strokeWidth="1.25"
                  />
                  <circle cx="8" cy="7.2" r="1.3" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </button>
            </>
          ) : null}
          <button
            type="button"
            className={`${css.iconBtn}${ui.clientView ? ` ${css.iconBtnActive}` : ""}`}
            data-testid="client-view-top"
            aria-label={ui.clientView ? "Exit client view" : "Client presentation"}
            title={ui.clientView ? "Exit client presentation" : "Client presentation"}
            onClick={() =>
              studio.setUi({
                clientView: !ui.clientView,
                focusOn: !ui.clientView,
                ghostReviewOpen: false,
              })
            }
          >
            <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M2.5 8s2.2-3.5 5.5-3.5S13.5 8 13.5 8s-2.2 3.5-5.5 3.5S2.5 8 2.5 8z"
                stroke="currentColor"
                strokeWidth="1.25"
              />
              <circle cx="8" cy="8" r="1.4" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          {!ui.clientView ? (
            <button
              type="button"
              className={`${css.iconBtn}${ui.mode === "share" ? ` ${css.iconBtnActive}` : ""}`}
              data-testid="share-top"
              aria-label="Share"
              title="Share"
              onClick={() => studio.setMode("share")}
            >
              <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="12" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="4" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="12" cy="12" r="1.6" stroke="currentColor" strokeWidth="1.2" />
                <path
                  d="M5.4 7.3 10.5 4.8M5.4 8.7l5.1 2.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            className={css.cmdBtn}
            data-testid="canvas-command-top"
            onClick={() => studio.setUi({ cmdOpen: true })}
            title="Command palette"
          >
            ⌘K
          </button>
          {!ui.clientView && !ui.foundationCleanse && !ui.frameOn ? (
            <button
              type="button"
              className={`${css.aiPill}${ai.pendingCount > 0 ? ` ${css.aiPillHot}` : ""}${ai.status === "verified" && ai.pendingCount === 0 ? ` ${css.aiPillOk}` : ""}`}
              data-testid="header-accept-ghosts"
              onClick={() => {
                if (ai.status === "scanning" || ai.status === "assisting") {
                  studio.setUi({ cmdOpen: true, cmdQuery: "" });
                  return;
                }
                if (ai.pendingCount === 0) {
                  void ai.scan();
                  return;
                }
                studio.setUi({ ghostReviewOpen: true });
              }}
            >
              {draftLabel}
            </button>
          ) : null}
          <span
            className={`${css.savedTick}${ui.saveStatus === "saving" ? ` ${css.savedTickPulse}` : ""}`}
            data-testid="autosave-tick"
            data-status={ui.saveStatus}
          >
            {ui.saveStatus === "saving"
              ? "Saving"
              : ui.saveStatus === "error"
                ? "Retry"
                : ui.saveStatus === "saved"
                  ? "Saved"
                  : ""}
          </span>
        </div>
      </header>

      <div
        className={`${css.board}${compliance.canvasSignal === "critical" ? ` ${css.boardCritical}` : ""}${compliance.canvasSignal === "watch" ? ` ${css.boardWatch}` : ""}`}
        data-testid="studio-board"
        ref={boardRef}
      >
        {ui.mode === "elevation" ? (
          <ElevationBoard
            axis={ui.elevAxis}
            boundary={studio.boundary}
            building={studio.building}
            items={studio.items}
            selectedId={ui.selectedId}
            onSelect={(id) => studio.setUi({ selectedId: id })}
            onToggleAxis={() =>
              studio.setUi({ elevAxis: ui.elevAxis === "x" ? "y" : "x" })
            }
            onTraceInPlan={(id) => {
              studio.setUi({ selectedId: id });
              studio.setMode("cad");
            }}
          />
        ) : null}

        {ui.mode === "quote" ? (
          <QuoteSurface
            address={displayAddress}
            estimate={estimate}
            draftUnverified={ai.status === "unverified"}
            pendingGhosts={ai.pendingCount}
            onReviewGhosts={() => {
              studio.setMode("cad");
              ai.openReview();
            }}
            onShare={() => studio.setMode("share")}
            onBack={() => studio.setMode("cad")}
          />
        ) : null}

        {ui.mode === "share" ? (
          <ShareSurface
            projectId={projectId}
            draftUnverified={ai.status === "unverified"}
            pendingGhosts={ai.pendingCount}
            quotePersisted={quotePersisted}
            portalUri={portalUri}
            onQuotePersisted={(uri) => {
              setQuotePersisted(true);
              setPortalUri(uri);
            }}
            onReviewGhosts={() => {
              studio.setMode("cad");
              ai.openReview();
            }}
            onBack={() => studio.setMode("cad")}
          />
        ) : null}

        {planOn ? (
          <div
            className={`${css.zoomWorld}${ui.frameOn ? ` ${css.zoomWorldClipped}` : ""}`}
            data-print-keep="plan"
            style={{
              transformOrigin: `${ui.focusX}% ${ui.focusY}%`,
              transform: `scale(${ui.zoom})`,
              cursor: studioCursor,
              ...(ui.frameOn
                ? (() => {
                    const sheet = sheetBoxFor(
                      boardSize.w,
                      boardSize.h,
                      ui.paper,
                    );
                    const titleW = titlePanelWidth(sheet.boxW);
                    const elevH = ui.sheetElevOn ? 56 * 2 + 34 : 0;
                    const plot = plotBoxFor(sheet, { titleW, elevH });
                    return {
                      clipPath: `inset(${plot.boxTop}px ${Math.max(0, boardSize.w - plot.boxLeft - plot.boxW)}px ${Math.max(0, boardSize.h - plot.boxTop - plot.boxH)}px ${plot.boxLeft}px)`,
                    };
                  })()
                : null),
            }}
          >
            <AerialSlot
              uri={liveAerial}
              dimmed={ui.darkOn}
              frameOn={ui.frameOn}
              scanning={
                aerialOk &&
                (ui.canopyScanning || ai.busy === "scanning")
              }
              zoom={ui.zoom}
              sheetScaleDenom={ui.sheetScaleDenom}
              darkOn={ui.darkOn}
              foundationCleanse={ui.foundationCleanse}
              allowAerial={aerialOk}
              allowPlanUnderlay={draftingPlate && !ui.foundationCleanse}
              autoCanopyScan={false}
              titleLocked={titleLocked}
              boundarySource={ui.boundarySource}
              siteLabel={displayAddress}
              address={displayAddress}
              suppressSiteCue={titleCueOnCad}
              parchmentPeel={
                draftingPlate || ui.foundationCleanse ? 1 : ui.parchmentPeel
              }
              hasGeometry={hasGeometry}
              canvasEngaged={canvasEngaged}
              onUri={(uri) => {
                // Survey aerial OR CAD/Sketch plan underlay (SVG/PNG)
                if (!aerialOk && !draftingPlate) return;
                studio.setUi({
                  aerialUri: uri,
                  aerialSuppressed: uri == null,
                });
              }}
              onScanning={(canopyScanning) => studio.setUi({ canopyScanning })}
              onCanopyImage={ai.ingestCanopyImage}
            />
            <ShadeGridOverlay
              active={ui.shadeOn && !ui.frameOn && !ui.focusOn}
              sunMin={ui.sunMin}
              lat={projectLat ?? undefined}
              lng={projectLng ?? undefined}
            />
            <CadPlanBoard
              frameOn={ui.frameOn}
              darkOn={ui.darkOn}
              foundationCleanse={ui.foundationCleanse}
              titleLocked={titleLocked}
              titleBoundaryLocked={ui.titleBoundaryLocked}
              scaleM={scaleM}
              lotAreaM2={titleBlock?.lotAreaM2 ?? outdoor}
              siteLabel={displayAddress}
              titleMeta={
                titleBlock
                  ? {
                      parcelRef: titleBlock.parcelRef,
                      sourceLabel: titleBlock.sourceLabel,
                      councilLabel: titleBlock.councilLabel,
                      sourceKind: titleBlock.sourceKind,
                    }
                  : null
              }
              boundary={studio.boundary}
              building={studio.building}
              easements={studio.easements}
              services={studio.services}
              items={studio.items}
              mode={ui.mode}
              tool={ui.foundationCleanse && !ui.titleBoundaryLocked ? "edit" : ui.tool}
              locked={ui.foundationCleanse ? false : ui.locked}
              layerOpacity={ui.layerOpacity}
              setbackOn={ui.setbackOn}
              councilSetbackM={compliance.setbackM}
              growth={ui.growth}
              selectedId={ui.selectedId}
              groupIds={ui.groupIds}
              hoverId={ui.hoverId}
              curGhostId={ai.current?.id ?? null}
              reviewOpen={ui.ghostReviewOpen}
              flaggedIds={flaggedIds}
              tpzReadouts={tpzReadouts}
              onSelect={(id, opts) => {
                // Selecting geometry / symbols is not a toolbox summon.
                setInstrumentsSummoned(false);
                if (!id) {
                  studio.setSelection(null, []);
                  return;
                }
                if (ai.pending.some((g) => g.id === id)) {
                  const idx = ai.pending.findIndex((g) => g.id === id);
                  studio.setUi({
                    selectedId: id,
                    groupIds: [],
                    ghostIdx: idx >= 0 ? idx : ui.ghostIdx,
                    ghostReviewOpen: true,
                  });
                  return;
                }
                if (opts?.additive) {
                  const next = ui.groupIds.includes(id)
                    ? ui.groupIds.filter((g) => g !== id)
                    : [...ui.groupIds, id];
                  studio.setSelection(id, next.length ? next : [id]);
                  return;
                }
                studio.setSelection(id, [id]);
              }}
              onMarqueeSelect={(ids) => {
                setInstrumentsSummoned(false);
                studio.setSelection(ids[0] ?? null, ids);
              }}
              onEmptyClick={({ x, y, insideLot }) => {
                if (insideLot) {
                  // On the drawing — clear selection only; keep toolbox closed.
                  setInstrumentsSummoned(false);
                  return;
                }
                // Off the lot, on the canvas margin — pin + summon instruments.
                pinInstrumentAnchor(x, y);
                setInstrumentsSummoned(true);
              }}
              onCadHandleInteract={() => setInstrumentsSummoned(false)}
              onHover={(id) => studio.setUi({ hoverId: id })}
              onAcceptGhost={ai.accept}
              onRejectGhost={ai.reject}
              onTraceInElevation={(id) => {
                studio.setSelection(id, [id]);
                studio.setMode("elevation");
              }}
              onBoundaryChange={studio.updateBoundary}
              onBuildingChange={studio.updateBuilding}
              onPlace={(x, y) => {
                studio.placeArmed(x, y);
              }}
              onMoveItem={studio.moveItem}
              onMoveGroup={studio.moveGroup}
              onTransformItem={studio.transformItem}
              gridGrain={ui.gridGrain}
              gridSnap={ui.gridSnap}
              gridFormation={gridPreviewFormation ?? ui.gridFormation}
              gridInk={gridPreviewInk ?? ui.gridInk}
              onPaintItem={(id) => {
                studio.paintItem(id);
                flashPaintTarget(id);
              }}
              paintFlashId={paintFlashId}
              eyedropArmed={eyedropArmed}
              onEyedrop={pickStyle}
              onBoardCursor={setBoardCursor}
            />
            {chrome.floraRing && ui.floraSession ? (
              <FloraRing
                xPct={ui.floraSession.x}
                yPct={ui.floraSession.y}
                candidates={ui.floraSession.candidates}
                activeIdx={ui.floraSession.activeIdx}
                previewSpreadPct={Math.min(
                  28,
                  Math.max(
                    6,
                    (ui.floraSession.candidates[ui.floraSession.activeIdx]
                      ?.canopySpreadM ?? 2) * 2.4,
                  ),
                )}
                onActiveIdx={studio.setFloraActiveIdx}
                onAccept={studio.acceptFlora}
                onDismiss={studio.dismissFlora}
              />
            ) : null}
            {chrome.horizon ? (
              <HorizonMarkers
                cards={actionHorizon}
                onFocus={(card) => {
                  if (card.suggestType) {
                    acceptHorizonCard(card);
                    return;
                  }
                  studio.setUi({
                    utilityPanel: "bom",
                  });
                }}
              />
            ) : null}
            {chrome.volumeIsolith ? (
              <VolumetricIsolith
                estimate={estimate}
                proximity={
                  drawingHot &&
                  (ui.armed === "paving" ||
                    ui.armed === "deck" ||
                    ui.tool === "edit")
                }
              />
            ) : null}
            {ui.mode === "sketch" ? (
              <SketchBoard
                strokes={studio.strokes}
                darkOn={ui.darkOn}
                formalizing={formalizing}
                onCommit={(stroke) => {
                  studio.setStrokes([...studio.strokes, stroke]);
                }}
                onTidy={() => studio.tidySketches()}
                onFormalizeToCad={() => {
                  void runFormalizeToCad();
                }}
              />
            ) : null}
            {ui.mode === "survey" && !ui.frameOn ? (
              <>
                <SurveyAnnotationLayer
                  active
                  tool={ui.tool}
                  levels={studio.levels}
                  services={studio.services}
                  easements={studio.easements}
                  scaleM={scaleM}
                  darkOn={ui.darkOn}
                  layerOpacity={ui.layerOpacity}
                  onAddLevel={studio.addSpotLevel}
                  onCommitService={studio.commitService}
                  onCalibrate={(nextScaleM) => {
                    // Prototype: board width metres from two known points.
                    // Also snap sheet denom so the ground mesh stays coherent.
                    const denoms = [50, 100, 200, 250, 500] as const;
                    const target = (nextScaleM / 110) * 100;
                    let best: (typeof denoms)[number] = 100;
                    let bestD = Infinity;
                    for (const d of denoms) {
                      const err = Math.abs(d - target);
                      if (err < bestD) {
                        bestD = err;
                        best = d;
                      }
                    }
                    studio.setUi({
                      boardWidthM: nextScaleM,
                      sheetScaleDenom: best,
                      tool: "pan",
                    });
                  }}
                />
                {!ui.focusOn && !ui.clientView ? (
                  <SurveyChecklist
                    boundary={studio.boundary}
                    building={studio.building}
                    items={studio.items}
                    levels={studio.levels}
                    services={studio.services}
                    easements={studio.easements}
                  />
                ) : null}
              </>
            ) : null}
            <TraceOverlay
              active={ui.tool === "trace" && !ui.frameOn && ui.mode !== "sketch"}
              locked={ui.locked}
              target={ui.traceTarget}
              drawPoly={ui.drawPoly}
              drawCursor={ui.drawCursor}
              onTarget={studio.setTraceTarget}
              onCursor={(drawCursor) => studio.setUi({ drawCursor })}
              onPush={studio.pushTracePoint}
              onFinish={studio.finishTrace}
              onCancel={studio.cancelTrace}
              onPop={studio.popTracePoint}
            />
            <MeasureOverlay
              active={ui.tool === "measure" && !ui.frameOn}
              scaleM={scaleM}
              onCancel={() => {
                studio.setTool("pan");
                setInstrumentsSummoned(false);
              }}
            />
            {(ui.mode === "cad" || ui.mode === "sketch") && !ui.frameOn ? (
              <ZoneOverlay
                active={ui.tool === "zone"}
                kind={ui.zoneKind}
                zones={studio.irrigationZones}
                onCommit={studio.commitZone}
              />
            ) : null}
            {ui.tool === "zone" && !ui.focusOn && !ui.clientView ? (
              <NicheToolCarousel
                testId="zone-kind-bar"
                label="Zone type"
                xPct={instrumentAnchor.x}
                yPct={instrumentAnchor.y}
                tools={nicheToolsForZone()}
                activeId={zoneNicheActiveId(ui.zoneKind)}
                onSelect={(tool: NicheTool) => {
                  if (tool.id === "zone-drip") {
                    studio.setUi({ zoneKind: "drip" });
                  } else if (tool.id === "zone-lighting") {
                    studio.setUi({ zoneKind: "lighting" });
                  }
                }}
              />
            ) : null}
            {instrumentsSummoned &&
            (ui.tool === "edit" ||
              ui.tool === "paint" ||
              ui.tool === "add" ||
              ui.tool === "pan") &&
            !ui.focusOn &&
            !ui.clientView &&
            !ui.frameOn &&
            !ui.foundationCleanse ? (
              <DraftGridStudio
                anchorXPct={instrumentAnchor.x}
                anchorYPct={instrumentAnchor.y}
                formation={ui.gridFormation}
                ink={ui.gridInk}
                grain={ui.gridGrain}
                snap={ui.gridSnap}
                onPreviewFormation={setGridPreviewFormation}
                onPreviewInk={setGridPreviewInk}
                onCommit={(patch) => {
                  const next = {
                    gridFormation: patch.formation ?? ui.gridFormation,
                    gridInk: patch.ink ?? ui.gridInk,
                    gridGrain: patch.grain ?? ui.gridGrain,
                    gridSnap: patch.snap ?? ui.gridSnap,
                  };
                  studio.setUi(next);
                  saveGridStudioPrefs(projectId, {
                    formation: next.gridFormation,
                    ink: next.gridInk,
                    grain: next.gridGrain,
                    snap: next.gridSnap,
                  });
                }}
              />
            ) : null}
            {/* Orbit sprouts with selection wash — Delete / Lock / Ask AI clear of glyph */}
            {selectedLive &&
            ui.tool !== "zone" &&
            (chrome.selectionRing ||
              ui.mode === "cad" ||
              ui.mode === "sketch" ||
              ui.mode === "survey") ? (
              <SelectionRing
                item={selectedLive}
                xPct={selectedLive.x}
                yPct={selectedLive.y}
                locked={ui.locked}
                onDelete={studio.deleteSelected}
                onClose={() => studio.setSelection(null, [])}
                onLock={() => studio.setTool(ui.locked ? "pan" : "lock")}
                onAskAi={() =>
                  studio.setUi({
                    cmdOpen: true,
                    cmdQuery: `about ${BY_TYPE[selectedLive.t]?.tag ?? selectedLive.t}`,
                  })
                }
              />
            ) : null}
            {chrome.tradeMargin && selectedTradeTag && selectedLive ? (
              <TradeSkuTag
                match={selectedTradeTag}
                xPct={selectedLive.x}
                yPct={selectedLive.y}
              />
            ) : null}
            {chrome.tradeMargin ? (
              <AmbientBudgetMargin
                trade={trade}
                displayTotalInclGst={estimate.totalInclGst}
              />
            ) : null}
          </div>
        ) : null}

        {ui.frameOn && planOn ? (
          <FitSheetOverlay
            boardW={boardSize.w}
            boardH={boardSize.h}
            paper={ui.paper}
            address={displayAddress}
            boundary={studio.boundary}
            building={studio.building}
            items={studio.items}
            easements={studio.easements}
            services={studio.services}
            showElevations={ui.sheetElevOn}
            scaleDenom={ui.sheetScaleDenom}
            onScaleDenom={(sheetScaleDenom) => studio.setUi({ sheetScaleDenom })}
            titleBlock={titleBlock}
          />
        ) : null}

        {chrome.ambientRibbon ? (
          <AmbientRibbon
            tool={ui.tool}
            mode={ui.mode}
            locked={ui.locked}
            canUndo={studio.canUndo}
            canRedo={studio.canRedo}
            layerChips={layerChips}
            layerOpacity={ui.layerOpacity}
            parchmentPeel={ui.parchmentPeel}
            hasAerial={Boolean(liveAerial)}
            anchorXPct={instrumentAnchor.x}
            anchorYPct={instrumentAnchor.y}
            summoned={instrumentsSummoned}
            onDismissSummon={() => setInstrumentsSummoned(false)}
            onTool={(t) => {
              setInstrumentsSummoned(true);
              studio.setTool(t);
            }}
            onMeasure={() => {
              setInstrumentsSummoned(true);
              studio.setTool(ui.tool === "measure" ? "pan" : "measure");
            }}
            onUndo={studio.undo}
            onRedo={studio.redo}
            onZoom={(delta) => {
              studio.setUi({ zoom: zoomByRibbonDelta(ui.zoom, delta) });
            }}
            onFit={() => {
              if (ui.foundationCleanse) {
                studio.setUi({ sheetScaleDenom: 100 });
              }
              studio.fitOutdoorView();
            }}
            onOpacity={studio.setLayerOpacity}
            onParchmentPeel={(parchmentPeel) => studio.setUi({ parchmentPeel })}
          />
        ) : null}


        {/*
          Inventory frost popup — Soft / Hard / Trees / Water / Library.
          Add-only: placing assets summons the popup at the cursor. Paint fills
          live in the persistent SwatchTray furniture, not a floating popup.
        */}
        {chrome.inventoryPopup && ui.tool === "add" ? (
          <KitAssetDock
            xPct={instrumentAnchor.x}
            yPct={instrumentAnchor.y}
            mode={ui.mode}
            armed={ui.armed}
            paintSwatch={ui.paintSwatch}
            tool={ui.tool}
            onArmMaterial={armType}
            onPaintMaterial={(t) =>
              studio.setUi({ paintSwatch: t, tool: "paint" })
            }
            onDismiss={() => studio.setTool("pan")}
          />
        ) : null}

        {pointerSettingsOpen ? (
          <PointerMarkSettings
            open
            markId={pointerMarkId}
            onPreview={setPointerMarkPreview}
            onMarkId={(id) => {
              setPointerMarkId(id);
              savePointerMarkId(id);
              setPointerMarkPreview(null);
            }}
            onClose={() => {
              setPointerMarkPreview(null);
              setPointerSettingsOpen(false);
            }}
          />
        ) : null}

        {!ui.focusOn &&
        !ui.clientView &&
        !ui.frameOn &&
        planOn &&
        selectedLive?.t === "exist" ? (
          <ExistTreeInspector
            xPct={selectedLive.x}
            yPct={selectedLive.y}
            dbhM={selectedLive.dbhM ?? ui.existDbhM}
            locked={ui.locked}
            onDbhM={studio.patchSelectedDbh}
          />
        ) : null}

        {ui.addOpen &&
        ui.armed === "exist" &&
        !selectedLive &&
        planOn &&
        !ui.focusOn ? (
          <label
            className={css.dbhField}
            data-testid="exist-dbh-field"
            style={
              {
                left: `${instrumentAnchor.x}%`,
                top: `${Math.min(88, instrumentAnchor.y + 10)}%`,
              } as CSSProperties
            }
          >
            <span>DBH m</span>
            <input
              type="number"
              min={0.05}
              max={2}
              step={0.01}
              inputMode="decimal"
              value={ui.existDbhM}
              aria-label="Existing tree DBH in metres"
              onChange={(e) => {
                const n = Number.parseFloat(e.target.value);
                if (!Number.isFinite(n) || n <= 0) return;
                studio.setUi({
                  existDbhM: Math.min(2, Math.max(0.05, n)),
                });
              }}
            />
          </label>
        ) : null}

        {chrome.aiSidecar &&
        planOn &&
        !ui.focusOn &&
        !ui.clientView &&
        !ui.frameOn &&
        !ui.foundationCleanse ? (
          <LiveMeasuresRail
            boundary={studio.boundary}
            building={studio.building}
            items={studio.items}
            scaleM={scaleM}
            schedule={siteSchedule}
            selected={selectedLive}
          />
        ) : null}

        {/*
          Canvas-first: the measures / quantity lane is summoned via the AI
          command core (Cmd+K → Live measures, Ask AI, accepted proposals),
          never parked on the drawing. `showDocks` reflects chrome.dataSummoned.
        */}
        {showDocks ? (
          <UtilityDrawer
            openPanel={ui.utilityPanel}
            collapsed={drawingHot}
            outdoorM2={outdoor}
            boundary={studio.boundary}
            items={studio.items}
            estimate={estimate}
            mitigated={ui.mitigated}
            complianceSignal={compliance.canvasSignal}
            compliancePass={
              [compliance.outdoorOk, compliance.permeableOk, compliance.canopyOk].filter(
                Boolean,
              ).length
            }
            councilSummary={{
              permeablePct: compliance.permeablePct,
              canopyPct: compliance.canopyPct,
              setbackM: compliance.setbackM,
            }}
            projectId={projectId}
            projectAddress={projectAddress}
            complianceReport={compliance}
            onClose={() => studio.setUi({ dataSummoned: false })}
            onOpenPanel={(utilityPanel) =>
              studio.setUi({
                utilityPanel,
                ...(utilityPanel === "compliance" ? { setbackOn: true } : {}),
              })
            }
            onMitigate={(id) =>
              studio.setUi({
                mitigated: { ...ui.mitigated, [id]: !ui.mitigated[id] },
              })
            }
            onOpenQuote={() => studio.setMode("quote")}
            settling={estimateSettling || ui.saveStatus === "saving"}
          />
        ) : null}

        {/* Sun scrubber is contextual — only when the operator armed shade mesh. */}
        {chrome.sunGrowth ? (
          <SunGrowthDock
            sunMin={ui.sunMin}
            growth={ui.growth}
            playing={ui.sunPlay}
            onSunMin={(sunMin) => studio.setUi({ sunMin })}
            onGrowth={(growth) => studio.setUi({ growth })}
            onPlaying={(sunPlay) => studio.setUi({ sunPlay })}
          />
        ) : null}

        {/* Design to-dos: background sync only — no canvas corner card */}
        {planOn && !ui.focusOn && !ui.clientView && !ui.frameOn ? (
          <PermitTodosPanel
            projectId={projectId}
            address={projectAddress}
            outdoorM2={outdoor}
            items={studio.items}
            compliance={compliance}
            syncOnly
          />
        ) : null}

        {chrome.horizon ? (
          <PreemptiveHorizon
            cards={actionHorizon}
            onAccept={acceptHorizonCard}
            onDismiss={(id) =>
              studio.setUi({
                mitigated: { ...ui.mitigated, [id]: true },
              })
            }
          />
        ) : null}

        {!ui.focusOn && !ui.clientView && !ui.frameOn && ui.councilTip ? (
          <div className={css.councilTip} data-testid="council-setback-tip">
            {ui.councilTip}
          </div>
        ) : null}

        {draftSurface && ui.ghostReviewOpen ? (
          <div className={css.ghostPanel}>
            <AiGhostReview
              ghosts={ai.pending}
              items={studio.items}
              boundary={studio.boundary}
              building={studio.building}
              scaleM={scaleM}
              sunMin={ui.sunMin}
              growth={ui.growth}
              selectedId={ai.current?.id ?? null}
              factorsOpen={ui.factorsOpen}
              onFactorsOpen={(factorsOpen) => studio.setUi({ factorsOpen })}
              onSelect={(id) => {
                const idx = ai.pending.findIndex((g) => g.id === id);
                studio.setUi({ ghostIdx: idx >= 0 ? idx : ui.ghostIdx });
              }}
              onAccept={ai.accept}
              onReject={ai.reject}
              onCycle={ai.cycle}
              onAskAi={(id) => {
                const g = ai.pending.find((x) => x.id === id);
                void ai.assist(g?.why ?? "refine this suggestion");
              }}
            />
          </div>
        ) : null}

        {chrome.structureRail ? (
          <LayersPanel
            open={ui.layersOpen}
            opacity={ui.layerOpacity}
            setbackOn={ui.setbackOn}
            shadeOn={ui.shadeOn}
            items={studio.items}
            onClose={() => studio.setUi({ layersOpen: false })}
            onOpacity={studio.setLayerOpacity}
            onSetback={(setbackOn) => studio.setUi({ setbackOn })}
            onShade={(shadeOn) => studio.setUi({ shadeOn })}
          />
        ) : null}

        {swatchTrayOn ? (
          <SwatchTray
            activeSwatch={ui.paintSwatch}
            armed={ui.tool === "paint" && !eyedropArmed}
            eyedropOn={eyedropArmed}
            onPick={(t) => {
              setEyedropArmed(false);
              studio.setUi({ paintSwatch: t, tool: "paint" });
            }}
            onEyedrop={() => setEyedropArmed((v) => !v)}
          />
        ) : null}

        {swatchTrayOn &&
        studio.boundary.length < 3 &&
        studio.items.length === 0 &&
        studio.strokes.length === 0 ? (
          <div className={css.onboardHint} data-testid="studio-onboard-hint">
            <p className={css.onboardHintTitle}>Trace the boundary to begin</p>
            <p className={css.onboardHintMeta}>
              ⌘K to ask AI · summon instruments from the margin
            </p>
          </div>
        ) : null}

        <SiteSwitcher
          open={ui.sitesOpen}
          siteIdx={ui.siteIdx}
          onClose={() => studio.setUi({ sitesOpen: false })}
          onPick={studio.switchSite}
        />

        <StudioCommandPalette
          open={ui.cmdOpen}
          query={ui.cmdQuery}
          onQuery={(cmdQuery) => studio.setUi({ cmdQuery })}
          onClose={() => studio.setUi({ cmdOpen: false, cmdQuery: "" })}
          onAskAi={(q) => void ai.assist(q)}
          onArm={armType}
          onScanGhosts={() => void ai.scan()}
          onConvertSketch={
            formalizing ? undefined : () => void runFormalizeToCad()
          }
          onToggleFitSheet={() => studio.setUi({ frameOn: !ui.frameOn })}
          onGoQuote={() => studio.setMode("quote")}
          onToggleFocus={() => studio.setUi({ focusOn: !ui.focusOn })}
          dataOpen={ui.dataSummoned}
          onToggleData={() =>
            studio.setUi({
              dataSummoned: !ui.dataSummoned,
              utilityPanel: ui.dataSummoned ? null : (ui.utilityPanel ?? "bom"),
            })
          }
          onUndo={studio.undo}
          onRedo={studio.redo}
        />

      </div>
    </div>
  );
}
