"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
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
import {
  loadFitSheetPrefs,
  saveFitSheetPrefs,
} from "./features/fitSheet/fitSheetPrefs";
import { AiGhostReview } from "./features/aiGhosts/AiGhostReview";
import { LayersPanel } from "./features/layers/LayersPanel";
import { RightDataLane } from "./features/surfaces/DataLaneSlot";
import {
  RIGHT_DATA_LANE_WIDTH_PX,
  toggleRightDataPanel,
} from "./features/surfaces/rightDataLane";
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
import { GroundRulerOverlay } from "./features/ground/GroundRulerOverlay";
import { TactileGround } from "./features/ground/TactileGround";
import { ShadeGridOverlay } from "./features/shade/ShadeGridOverlay";
import { SketchBoard } from "./features/sketch/SketchBoard";
import { rasterizeStrokesToPng } from "./features/sketch/rasterizeStrokes";
import { SurveyAnnotationLayer } from "./features/survey/SurveyAnnotationLayer";
import { SurveyChecklist } from "./features/survey/SurveyChecklist";
import { SiteSwitcher } from "./features/sites/SiteSwitcher";
import { ToolDock } from "./features/toolDock/ToolDock";
import { NicheToolCarousel } from "./features/kitInventory/NicheToolCarousel";
import { KitAssetDock } from "./features/kitInventory/KitAssetDock";
import { SwatchTray } from "./features/swatchTray/SwatchTray";
import {
  nicheToolsForZone,
  zoneNicheActiveId,
  type NicheTool,
} from "./features/kitInventory/nicheTools";
import { LiveMeasuresRail } from "./features/liveMeasures/LiveMeasuresRail";
import { CanvasMeasureSummary } from "./features/liveMeasures/CanvasMeasureSummary";
import {
  cancelToSelect,
  recordTool,
  toggleTool,
  type ToolStack,
} from "./features/toolStack/toolStack";
import { StudioContextBreadcrumb } from "./features/contextStrip/StudioContextBreadcrumb";
import {
  loadPointerMarkId,
  savePointerMarkId,
  type PointerMarkId,
} from "./features/pointer/pointerMarks";
import { resolveStudioCursor } from "./features/pointer/resolveStudioCursor";
import { CanvasAutosaveChip } from "./features/save/CanvasAutosaveChip";
import { clampToCanvasMargin } from "./features/reach/marginSummon";
import { SelectionRing } from "./features/selectionRing/SelectionRing";
import { SelectionDial } from "./features/selectionDial/SelectionDial";
import { SelectionFocusVeil } from "./features/selectionFocus/SelectionFocusVeil";
import { DialHintPill } from "./features/selectionDial/DialHintPill";
import { ExistTreeInspector } from "./features/selectionRing/ExistTreeInspector";
import { ZoneOverlay } from "./features/zones/ZoneOverlay";
import { PreemptiveHorizon } from "./features/horizon/PreemptiveHorizon";
import { HorizonMarkers } from "./features/horizon/HorizonMarkers";
import { ShareSurface } from "./features/share/ShareSurface";
import { ShareRevisionPopup } from "./features/share/ShareRevisionPopup";
import { FloraRing } from "./features/flora/FloraRing";
import { VolumetricIsolith } from "./features/isolith/VolumetricIsolith";
import { AmbientBudgetMargin } from "./features/trade/AmbientBudgetMargin";
import { TradeSkuTag } from "./features/trade/TradeSkuTag";
import { ITEM_LAYER } from "./state/studioTypes";
import {
  BOARD_WIDTH_M_AT_100,
} from "./features/ground/groundMetrics";
import {
  solveLiveTradeEstimate,
  tradeTagForItem,
  type ArchitecturalTitleBlock,
} from "@workstream/domain";
import type {
  CanvasAnnotation,
  CatalogPlacement,
  CanvasStroke,
  DesignSiteFrame,
  LandscapeFeature,
  IrrigationZone,
} from "@workstream/contracts";
import {
  plotBoxFor,
  sheetBoxFor,
  sheetContentView,
  SHEET_SCALE_STEPS,
  SHEET_TITLE_STRIP_H,
  titlePanelWidth,
  clientToBoardPct,
} from "./geometry";
import { CameraChrome, boardCameraFromPlan } from "./CameraChrome";
import {
  clampZoom,
  zoomByKeyStep,
  zoomFromWheel,
} from "./geometry/canvasZoom";
import { nextBoardSize } from "./geometry/boardSizeCommit";
import {
  normalizeViewRotationDeg,
  stepViewRotationDeg,
  type ViewRotationStepDeg,
} from "./geometry/canvasViewRotation";
import { ViewNorthControl } from "./features/viewRotate/ViewNorthControl";
import { isPanGesture, nextPanOffset } from "./geometry/canvasPan";
import { TiltHintPill } from "./features/tilt/TiltHintPill";
import {
  TILT_ANIM_MS_FAST,
  TILT_ANIM_MS_SLOW,
  TILT_DEG,
  isTiltActive,
  settleTiltDeg,
  tiltFromDragDelta,
} from "./features/tilt/tiltMath";
import { usePresentationLens } from "./features/render/usePresentationLens";
import {
  clampNotePos,
  defaultNotePos,
} from "./features/render/annotationLayout";
import {
  formalizeSketchToCadAction,
  lookupCadastralTitleAction,
} from "../../../app/actions";
import { useToast } from "../../ToastHost";
import { suggestedMode, unlockedModes } from "../../../lib/canvas-mode";
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
  initialAnnotations?: CanvasAnnotation[];
  initialFeatures?: LandscapeFeature[];
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
  initialAnnotations = [],
  initialFeatures = [],
  hasQuote = false,
  quotePortalUri = null,
  initialTitleBlock = null,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    initialAnnotations,
    initialFeatures,
  });
  const toast = useToast();
  const [gridPreviewFormation, setGridPreviewFormation] =
    useState<GridFormation | null>(null);
  const [gridPreviewInk, setGridPreviewInk] = useState<GridInk | null>(null);
  const [annotatePhase, setAnnotatePhase] = useState<"off" | "place" | "type">(
    "off",
  );
  const [pendingAnnotation, setPendingAnnotation] = useState<{
    anchor: CanvasAnnotation["anchor"];
    notePos: { x: number; y: number };
  } | null>(null);
  const [annotateDraft, setAnnotateDraft] = useState("");
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    string | null
  >(null);

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
  const { fidelity, markInteracting } = usePresentationLens({
    forcePresentation: ui.clientView || ui.frameOn,
  });
  /** Prefer Turf workable outdoor; fall back to project / seed area. */
  const outdoor = workableOutdoorM2 > 0 ? workableOutdoorM2 : fallbackOutdoor;
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState({ w: 960, h: 640 });
  /**
   * Drag-to-pan — Space held (grab, armed) vs actively dragging (grabbing).
   * spaceHeldRef/panDragBaseRef back the gesture listeners so pan drags
   * survive re-renders without tearing down mid-drag.
   */
  const spaceHeldRef = useRef(false);
  const [spacePanArmed, setSpacePanArmed] = useState(false);
  const [isPanningActive, setIsPanningActive] = useState(false);
  const panBaseRef = useRef({ x: 0, y: 0 });
  /**
   * Sketch pad has no marquee — while the Pan tool is armed there, a plain
   * left-drag grabs the canvas (the pad steps aside; see SketchBoard.active).
   */
  const panToolGrabRef = useRef(false);
  /** Temporary CSS class on .zoomWorld only during tilt enter/exit (not wheel). */
  const [tiltAnimKind, setTiltAnimKind] = useState<"fast" | "slow" | null>(
    null,
  );
  const tiltAnimClearTimerRef = useRef<number | null>(null);
  const tiltDragRef = useRef<{ startY: number; startDeg: number } | null>(
    null,
  );
  const [tiltDiscoverHint, setTiltDiscoverHint] = useState(false);
  const [tiltPauseHint, setTiltPauseHint] = useState(false);
  const tiltHintSeenRef = useRef(false);
  const [quotePersisted, setQuotePersisted] = useState(hasQuote);
  const [portalUri, setPortalUri] = useState<string | null>(quotePortalUri);
  const [sharePopupOpen, setSharePopupOpen] = useState(false);
  const [latestShare, setLatestShare] = useState<
    import("@workstream/contracts").ShareRevision | null
  >(null);
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
  /** Drafting grid controls — toggled from the tool dock (not a separate cluster). */
  const [gridStudioOpen, setGridStudioOpen] = useState(false);
  const [dialHint, setDialHint] = useState(false);
  const dialHintSeenRef = useRef(false);
  /** One-time "drop the tool to select" hint — objects are inert in tools. */
  const [selectHint, setSelectHint] = useState(false);
  const selectHintSeenRef = useRef(false);
  const onInertToolClick = useCallback(() => {
    if (selectHintSeenRef.current) return;
    selectHintSeenRef.current = true;
    try {
      if (window.localStorage.getItem("ws-select-hint-seen") === "1") return;
      window.localStorage.setItem("ws-select-hint-seen", "1");
    } catch {
      /* ignore */
    }
    setSelectHint(true);
  }, []);
  /** Hold R + arrows → rotate selection in 15° detents. */
  const rotateChordRef = useRef(false);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (
        (e.key === "r" || e.key === "R") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        rotateChordRef.current = true;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") rotateChordRef.current = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  const [pointerMarkId, setPointerMarkId] = useState<PointerMarkId>("spade");
  /** Settings hover preview — persists only on click. */
  const [pointerMarkPreview, setPointerMarkPreview] =
    useState<PointerMarkId | null>(null);
  /** Handle hover from CadPlanBoard — move / add / paint affordances. */
  const [boardCursor, setBoardCursor] = useState<
    "default" | "move" | "add" | "paint" | null
  >(null);
  const [sketchChrome, setSketchChrome] = useState<{
    tool: "pen" | "eraser";
    tip: import("./features/sketch/sketchCursors").SketchTipGrade;
  }>({ tool: "pen", tip: "medium" });
  const onSketchChromeChange = useCallback(
    (chrome: {
      tool: "pen" | "eraser";
      tip: import("./features/sketch/sketchCursors").SketchTipGrade;
    }) => {
      setSketchChrome(chrome);
    },
    [],
  );
  /** Target settle-flash after a Paint apply — presentational confirmation only. */
  const [paintFlashId, setPaintFlashId] = useState<string | null>(null);
  const paintFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashPaintTarget = (id: string) => {
    setPaintFlashId(id);
    if (paintFlashTimer.current) clearTimeout(paintFlashTimer.current);
    paintFlashTimer.current = setTimeout(() => setPaintFlashId(null), 460);
  };
  /** Two-slot tool memory — Q flips back to the tool you left (AutoCAD-style). */
  const toolStackRef = useRef<ToolStack>({ current: ui.tool, previous: ui.tool });
  useEffect(() => {
    toolStackRef.current = recordTool(toolStackRef.current, ui.tool);
  }, [ui.tool]);
  /** Eyedropper — next canvas click loads that element's style into the swatch. */
  const [eyedropArmed, setEyedropArmed] = useState(false);
  /** Swatch/stamp hover preview — shows target result before commit. */
  const [previewSwatch, setPreviewSwatch] = useState<StudioItemType | null>(null);
  const pickStyle = (t: StudioItemType) => {
    setEyedropArmed(false);
    studio.setUi({ paintSwatch: t, tool: "paint" });
  };

  useEffect(() => {
    setPointerMarkId(loadPointerMarkId());
  }, []);

  /** Surface autosave failure once — chip stays the daily status; toast is the alert. */
  const lastSaveErrorToast = useRef(false);
  useEffect(() => {
    if (ui.saveStatus === "error") {
      if (lastSaveErrorToast.current) return;
      lastSaveErrorToast.current = true;
      const detail =
        ui.saveErrorKind === "unreachable"
          ? "Couldn't reach the server. Tap Retry save in the header before leaving."
          : "Server rejected the save. Tap Retry save in the header before leaving.";
      toast.show(detail, "error", 6000);
      return;
    }
    if (ui.saveStatus === "saved" || ui.saveStatus === "saving") {
      lastSaveErrorToast.current = false;
    }
  }, [toast, ui.saveStatus, ui.saveErrorKind]);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const commitSize = (w: number, h: number) => {
      // CSS px only (DPR-invariant). See geometry/boardSizeCommit.ts.
      setBoardSize((prev) => nextBoardSize(prev, w, h) ?? prev);
    };
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      commitSize(cr.width, cr.height);
    });
    ro.observe(el);
    commitSize(el.clientWidth, el.clientHeight);
    return () => ro.disconnect();
  }, []);

  /**
   * Print geometry — scale the A3/A4 sheet box to fill the physical paper.
   * The sheet box and the paper share an aspect ratio (see sheetBoxFor), so
   * the fit factor is uniform. Exposed as CSS vars so the print stylesheet
   * works for window.print(), print-media emulation, and headless PDF alike
   * (no dependency on the beforeprint event, which never fires for PDF).
   */
  const printSheet = useMemo(() => {
    if (!ui.frameOn || boardSize.w < 1 || boardSize.h < 1) return null;
    const MM_PX = 96 / 25.4;
    const paperMm =
      ui.paper === "a4"
        ? { w: 210, h: 297 } // portrait
        : { w: 420, h: 297 }; // A3 landscape
    const paperW = paperMm.w * MM_PX;
    const paperH = paperMm.h * MM_PX;
    const sheet = sheetBoxFor(boardSize.w, boardSize.h, ui.paper);
    const fit = Math.min(paperW / sheet.boxW, paperH / sheet.boxH);
    return {
      left: sheet.boxLeft,
      top: sheet.boxTop,
      boardW: boardSize.w,
      boardH: boardSize.h,
      paperW,
      paperH,
      fit,
      paper: ui.paper,
    };
  }, [ui.frameOn, ui.paper, boardSize.w, boardSize.h]);

  /**
   * Infinite canvas zoom — wheel / trackpad / pinch over the board.
   * Active on Survey / Sketch / CAD including A3/A4 Fit sheet.
   * (Print 1:N is Alt+wheel on the Fit sheet HUD — not plain wheel.)
   */
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const planMode =
      ui.mode !== "elevation" && ui.mode !== "quote" && ui.mode !== "share";
    if (!planMode) return;
    const onWheel = (e: WheelEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [data-no-canvas-zoom]")) {
        return;
      }
      // Fit sheet: Alt+wheel reserved for print 1:N (FitSheetOverlay).
      if (ui.frameOn && e.altKey) return;
      e.preventDefault();
      markInteracting();
      const nextZoom = zoomFromWheel(ui.zoom, e.deltaY);
      if (ui.frameOn) {
        // Keep lot-centred sheet origin; zoom multiplies the paper fit.
        studio.setUi({ zoom: nextZoom });
        return;
      }
      const r = el.getBoundingClientRect();
      const rotateDeg =
        ui.mode === "cad" && !ui.clientView
          ? normalizeViewRotationDeg(ui.viewRotationDeg)
          : 0;
      const focus = clientToBoardPct(e.clientX, e.clientY, r, {
        boardW: el.clientWidth || 1,
        boardH: el.clientHeight || 1,
        zoom: clampZoom(ui.zoom),
        rotateDeg,
        panX: ui.panX,
        panY: ui.panY,
        focusX: ui.focusX,
        focusY: ui.focusY,
      });
      studio.setUi({
        focusX: Number(focus.x.toFixed(2)),
        focusY: Number(focus.y.toFixed(2)),
        zoom: nextZoom,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [
    studio,
    ui.frameOn,
    ui.mode,
    ui.zoom,
    ui.panX,
    ui.panY,
    ui.focusX,
    ui.focusY,
    ui.viewRotationDeg,
    ui.clientView,
  ]);

  /** Keeps the drag-start base fresh without re-subscribing gesture listeners. */
  useEffect(() => {
    panBaseRef.current = { x: ui.panX, y: ui.panY };
  }, [ui.panX, ui.panY]);

  useEffect(() => {
    /*
     * Sketch pad has nothing to marquee — Select-drag pans the camera there
     * (the pen only inks while armed). Plan modes marquee; pan is Space/middle.
     */
    panToolGrabRef.current = ui.mode === "sketch" && ui.tool === "select";
  }, [ui.mode, ui.tool]);

  /**
   * Space held → pan armed (CAD/Figma convention). Tracked outside React
   * state via a ref so the gesture listener below always reads it live;
   * mirrored into state only to drive the grab cursor.
   * Works on free plan and Fit sheet (pan inside the paper plot).
   */
  useEffect(() => {
    const planMode =
      ui.mode !== "elevation" && ui.mode !== "quote" && ui.mode !== "share";
    if (!planMode) return;
    const release = () => {
      spaceHeldRef.current = false;
      setSpacePanArmed(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;
      e.preventDefault();
      spaceHeldRef.current = true;
      setSpacePanArmed(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      release();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    // Alt-tabbing away while Space is held would otherwise strand it "armed".
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
      release();
    };
  }, [ui.mode]);

  /**
   * Drag-to-pan — middle-mouse or Space+drag translates the viewport
   * without touching selection. Intercepted at capture phase, ahead of
   * CadPlanBoard's marquee-select pointerdown, so the two never collide.
   * Enabled on Fit sheet too (pans inside the A3/A4 plot).
   */
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const planMode =
      ui.mode !== "elevation" && ui.mode !== "quote" && ui.mode !== "share";
    if (!planMode) return;
    const onPointerDownCapture = (e: PointerEvent) => {
      /* Pan-tool grab never swallows chrome (dock chips, tray buttons). */
      const overChrome = Boolean(
        (e.target as HTMLElement | null)?.closest(
          "button, input, select, textarea, [data-camera-chrome]",
        ),
      );
      if (
        !isPanGesture({
          button: e.button,
          spaceHeld: spaceHeldRef.current,
          panToolArmed: panToolGrabRef.current && !overChrome,
        })
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const base = panBaseRef.current;
      setIsPanningActive(true);
      el.setPointerCapture?.(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        markInteracting();
        const next = nextPanOffset(base, ev.clientX - startX, ev.clientY - startY);
        studio.setUi({ panX: next.x, panY: next.y });
      };
      const onUp = () => {
        setIsPanningActive(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        el.releasePointerCapture?.(e.pointerId);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    };
    el.addEventListener("pointerdown", onPointerDownCapture, { capture: true });
    return () =>
      el.removeEventListener("pointerdown", onPointerDownCapture, {
        capture: true,
      });
  }, [studio, ui.mode]);

  const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Keep tiltDeg readable inside long-lived gesture / tool listeners. */
  const tiltDegRef = useRef(ui.tiltDeg);
  useEffect(() => {
    tiltDegRef.current = ui.tiltDeg;
  }, [ui.tiltDeg]);

  /**
   * Drop the temp transition class. transitionend never fires when a
   * transition is cancelled (wheel mid-flatten, display:none) — without this
   * the class sticks and every wheel tick animates.
   */
  const clearTiltAnimKind = useCallback(() => {
    if (tiltAnimClearTimerRef.current != null) {
      window.clearTimeout(tiltAnimClearTimerRef.current);
      tiltAnimClearTimerRef.current = null;
    }
    setTiltAnimKind(null);
  }, []);

  useEffect(
    () => () => {
      if (tiltAnimClearTimerRef.current != null) {
        window.clearTimeout(tiltAnimClearTimerRef.current);
      }
    },
    [],
  );

  const animateTiltTo = useCallback(
    (nextDeg: number, slow = false) => {
      const clamped = Math.max(0, Math.min(60, nextDeg));
      if (Math.abs(tiltDegRef.current - clamped) < 0.05) {
        clearTiltAnimKind();
        return;
      }
      if (prefersReducedMotion()) {
        studio.setUi({ tiltDeg: clamped });
        clearTiltAnimKind();
        return;
      }
      if (tiltAnimClearTimerRef.current != null) {
        window.clearTimeout(tiltAnimClearTimerRef.current);
        tiltAnimClearTimerRef.current = null;
      }
      setTiltAnimKind(slow ? "slow" : "fast");
      studio.setUi({ tiltDeg: clamped });
      tiltAnimClearTimerRef.current = window.setTimeout(
        () => {
          tiltAnimClearTimerRef.current = null;
          setTiltAnimKind(null);
        },
        slow ? TILT_ANIM_MS_SLOW : TILT_ANIM_MS_FAST,
      );
    },
    [studio, clearTiltAnimKind],
  );

  /** Force flat when leaving plan / entering Fit / elevation / quote / share. */
  useEffect(() => {
    const planMode =
      ui.mode === "survey" || ui.mode === "sketch" || ui.mode === "cad";
    if (!planMode || ui.frameOn) {
      if (ui.tiltDeg !== 0) studio.setUi({ tiltDeg: 0 });
      clearTiltAnimKind();
      setTiltPauseHint((v) => (v ? false : v));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.mode, ui.frameOn, ui.tiltDeg, clearTiltAnimKind]);

  /** Pause hint tracks the lens. */
  useEffect(() => {
    const active = isTiltActive(ui.tiltDeg);
    setTiltPauseHint((v) => (v === active ? v : active));
  }, [ui.tiltDeg]);

  useEffect(() => {
    if (!isTiltActive(ui.tiltDeg)) return;
    if (!ui.selectedId && ui.groupIds.length === 0) return;
    studio.setSelection(null, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.tiltDeg, ui.selectedId, ui.groupIds.length]);

  /** Client view — slow 2s tilt-in flourish; flatten only when leaving client view. */
  const clientTiltOnceRef = useRef(false);
  const prevClientViewRef = useRef(ui.clientView);
  useEffect(() => {
    const wasClient = prevClientViewRef.current;
    prevClientViewRef.current = ui.clientView;
    if (!ui.clientView) {
      clientTiltOnceRef.current = false;
      if (wasClient && isTiltActive(tiltDegRef.current)) animateTiltTo(0);
      return;
    }
    if (clientTiltOnceRef.current) return;
    clientTiltOnceRef.current = true;
    animateTiltTo(TILT_DEG, true);
  }, [ui.clientView, animateTiltTo]);

  /** Arming any edit tool animates the lens flat (no jump cut). */
  const prevToolRef = useRef(ui.tool);
  useEffect(() => {
    const prev = prevToolRef.current;
    prevToolRef.current = ui.tool;
    if (prev === ui.tool) return;
    const editing =
      ui.tool === "add" ||
      ui.tool === "paint" ||
      ui.tool === "trace" ||
      ui.tool === "measure" ||
      ui.tool === "zone" ||
      ui.tool === "service" ||
      ui.tool === "calib" ||
      ui.tool === "level";
    if (editing && isTiltActive(tiltDegRef.current)) animateTiltTo(0);
  }, [ui.tool, animateTiltTo]);

  /** One-time discoverability after first CAD view-rotation. */
  useEffect(() => {
    if (tiltHintSeenRef.current) return;
    if (ui.mode !== "cad" || ui.frameOn || ui.clientView) return;
    if (ui.viewRotationDeg === 0) return;
    tiltHintSeenRef.current = true;
    setTiltDiscoverHint(true);
  }, [ui.viewRotationDeg, ui.mode, ui.frameOn, ui.clientView]);

  /**
   * Ctrl/Cmd + vertical drag tilts continuously. Capture-phase so it wins
   * over marquee; release below snap threshold returns flat.
   */
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const planMode =
      ui.mode === "survey" || ui.mode === "sketch" || ui.mode === "cad";
    if (!planMode || ui.frameOn) return;

    const onPointerDownCapture = (e: PointerEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startY = e.clientY;
      const startDeg = tiltDegRef.current;
      let lastY = startY;
      tiltDragRef.current = { startY, startDeg };
      clearTiltAnimKind();
      el.setPointerCapture?.(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        lastY = ev.clientY;
        markInteracting();
        studio.setUi({
          tiltDeg: tiltFromDragDelta(startDeg, lastY - startY),
        });
      };
      const onUp = () => {
        tiltDragRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        el.releasePointerCapture?.(e.pointerId);
        const raw = tiltFromDragDelta(startDeg, lastY - startY);
        const settled = settleTiltDeg(raw);
        if (settled !== raw) animateTiltTo(settled);
        else studio.setUi({ tiltDeg: settled });
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    };

    el.addEventListener("pointerdown", onPointerDownCapture, { capture: true });
    return () =>
      el.removeEventListener("pointerdown", onPointerDownCapture, {
        capture: true,
      });
  }, [studio, ui.mode, ui.frameOn, animateTiltTo, clearTiltAnimKind]);

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

  /** Restore fit-sheet / elevation prefs for this project session. */
  useEffect(() => {
    const prefs = loadFitSheetPrefs(projectId);
    if (!prefs) return;
    studio.setUi({
      ...(prefs.frameOn != null ? { frameOn: prefs.frameOn } : {}),
      ...(prefs.sheetElevOn != null ? { sheetElevOn: prefs.sheetElevOn } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    saveFitSheetPrefs(projectId, {
      frameOn: ui.frameOn,
      sheetElevOn: ui.sheetElevOn,
    });
  }, [projectId, ui.frameOn, ui.sheetElevOn]);

  /** Warn before leaving when canvas autosave failed or is in flight. */
  useEffect(() => {
    const dirty =
      ui.saveStatus === "error" ||
      ui.saveStatus === "saving" ||
      ui.saveStatus === "retrying";
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [ui.saveStatus]);

  /**
   * Fit to screen by default — outdoor garden remnant on Survey / Sketch / CAD.
   * Fit sheet uses sheetContentView (plan scales inside a fixed paper frame).
   */
  const outdoorFitKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (ui.focusOn || ui.clientView || ui.frameOn) return;
    if (
      ui.mode !== "survey" &&
      ui.mode !== "sketch" &&
      ui.mode !== "cad"
    ) {
      outdoorFitKeyRef.current = null;
      return;
    }
    const key = `${ui.mode}:${ui.siteIdx}`;
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
        if (annotatePhase !== "off") {
          e.preventDefault();
          setAnnotatePhase("off");
          setPendingAnnotation(null);
          setAnnotateDraft("");
          return;
        }
        if (isTiltActive(ui.tiltDeg)) {
          e.preventDefault();
          animateTiltTo(0);
          return;
        }
        if (ui.isolatedLayer) {
          e.preventDefault();
          studio.setUi({ isolatedLayer: null });
          return;
        }
        if (ui.floraSession) {
          studio.dismissFlora();
          return;
        }
        if (ui.drawPoly) {
          studio.cancelTrace();
          return;
        }
        // CAD practice: Esc cancels sticky draft tools → Select (KiCad / Fusion).
        if (isStickyDraftTool(ui.tool)) {
          e.preventDefault();
          toolStackRef.current = cancelToSelect(toolStackRef.current);
          studio.setTool("select");
          setInstrumentsSummoned(false);
          studio.setUi({
            factorsOpen: false,
            ghostReviewOpen: false,
            rightDataPanel: null,
            cmdOpen: false,
            addOpen: false,
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
          rightDataPanel: null,
          cmdOpen: false,
          addOpen: false,
          coachOpen: false,
          utilityPanel: null,
        });
        setInstrumentsSummoned(false);
        return;
      }
      if (
        e.key.toLowerCase() === "i" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        planOn &&
        !ui.frameOn
      ) {
        e.preventDefault();
        if (ui.isolatedLayer) {
          studio.setUi({ isolatedLayer: null });
          return;
        }
        const selected = studio.items.find(
          (item) => item.id === ui.selectedId && !item.ghost,
        );
        if (selected) {
          studio.setUi({ isolatedLayer: ITEM_LAYER[selected.t] });
        }
        return;
      }
      if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        // F = Fit sheet (product). Shift+F = zoom camera to selection.
        if (e.shiftKey) {
          if (!ui.frameOn) studio.fitSelectionView();
          return;
        }
        setFitSheetOn(!ui.frameOn);
        return;
      }
      /* Q flips back to the previous tool — no toolbar round trip. */
      if (
        e.key.toLowerCase() === "q" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        planOn &&
        !ui.frameOn
      ) {
        const next = toggleTool(toolStackRef.current);
        if (next !== ui.tool) {
          e.preventDefault();
          studio.setTool(next);
          setInstrumentsSummoned(true);
        }
        return;
      }
      /* +/- = scale selection when selected; else infinite zoom. Alt+/- = print 1:N. */
      if (
        (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") &&
        ui.mode !== "elevation" &&
        ui.mode !== "quote" &&
        ui.mode !== "share"
      ) {
        e.preventDefault();
        if (ui.frameOn && e.altKey) {
          studio.snapSheetScale(
            e.key === "-" || e.key === "_" ? 1 : -1,
          );
        } else if (
          ui.selectedId &&
          !ui.drawPoly &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.altKey
        ) {
          const item = studio.items.find((i) => i.id === ui.selectedId);
          if (item) {
            const delta = e.key === "-" || e.key === "_" ? -0.1 : 0.1;
            studio.transformItem(ui.selectedId, {
              scale: Math.max(0.35, Math.min(2.5, item.scale + delta)),
            });
          }
        } else {
          studio.setUi({
            zoom: zoomByKeyStep(
              ui.zoom,
              e.key === "-" || e.key === "_" ? -1 : 1,
            ),
          });
        }
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
      if (e.key === "[" || e.key === "]") {
        e.preventDefault();
        if (ui.selectedId && !ui.drawPoly) {
          // Per-asset clock rotate — never touches ui.viewRotationDeg.
          studio.rotateSelectedClock(e.key === "]" ? 1 : -1);
          return;
        }
        // No selection: CAD camera rotate by the active step (15/45/90).
        if (ui.mode === "cad" && !ui.frameOn && !ui.drawPoly) {
          const dir = e.key === "]" ? 1 : -1;
          studio.setUi({
            viewRotationDeg: stepViewRotationDeg(
              ui.viewRotationDeg,
              dir,
              ui.viewRotationStepDeg,
            ),
          });
        }
        return;
      }
      if (
        e.key === "0" &&
        e.shiftKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        ui.mode === "cad" &&
        !ui.frameOn
      ) {
        e.preventDefault();
        studio.setUi({ viewRotationDeg: 0 });
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
        rotateChordRef.current &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const dir =
          e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : -1;
        const item = studio.items.find((i) => i.id === ui.selectedId);
        if (item) {
          studio.transformItem(ui.selectedId, {
            rot: ((Math.round(item.rot / 15) * 15 + dir * 15) % 360 + 360) % 360,
          });
        }
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
        selectedAnnotationId &&
        !ui.drawPoly &&
        annotatePhase === "off"
      ) {
        e.preventDefault();
        const removed = studio.removeAnnotation(selectedAnnotationId);
        setSelectedAnnotationId(null);
        if (removed) {
          toast.show("Note removed", "info", 5000, {
            action: {
              label: "Undo",
              onClick: () => studio.restoreAnnotation(removed),
            },
          });
        }
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
    dataSummoned: ui.rightDataPanel === "measures",
  });
  const measuresOpen = ui.rightDataPanel === "measures";
  const layersOpen = ui.rightDataPanel === "layers";
  const sitesOpen = ui.rightDataPanel === "sites";
  const checklistOpen = ui.rightDataPanel === "checklist";
  const rightLaneBusy = ui.rightDataPanel != null;  const titleLocked =
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
  /** Fill palette — summoned on Add/Paint only (checklist 2). */
  const swatchTrayOn =
    (ui.mode === "cad" || ui.mode === "sketch") &&
    (ui.tool === "add" || ui.tool === "paint") &&
    !ui.frameOn &&
    !ui.focusOn &&
    !ui.clientView &&
    !ui.foundationCleanse;
  /** Undo filmstrip — CAD/survey only; Sketch uses MarginStrip history. */
  const undoFilmOn =
    (ui.mode === "cad" || ui.mode === "survey") &&
    !ui.frameOn &&
    !ui.focusOn &&
    !ui.clientView &&
    !ui.foundationCleanse;
  /** Draft AI surface only when chrome matrix allows (never Stage 1 / Fit). */
  const draftSurface = chrome.draftSurface;
  /** Prefer live project address; demo site switcher still re-queries Vicmap. */
  const displayAddress = studio.siteAddress || projectAddress;
  /**
   * Free-plan metres stay at the calibrated / default board width.
   * Print 1:N (`sheetScaleDenom`) must not stretch live CAD maths.
   */
  const scaleM = ui.boardWidthM ?? BOARD_WIDTH_M_AT_100;

  /**
   * Dark is a *screen* lens — it must never leak into the Fit sheet, which
   * is a print artifact and stays parchment regardless. `ui.darkOn` keeps
   * the toggle state; every render path reads `darkLens`.
   */
  const darkLens = ui.darkOn && !ui.frameOn;

  /**
   * Fit sheet layout — fixed plot clip + content scale from 1:N.
   * Clip must never share a node with transform (that locked frame to drawing).
   */
  const sheetPlotLayout = useMemo(() => {
    if (!ui.frameOn || boardSize.w < 1 || boardSize.h < 1) return null;
    const sheet = sheetBoxFor(boardSize.w, boardSize.h, ui.paper);
    /* A4 portrait reflows: title block becomes a bottom strip so the plot
       keeps full paper width (landscape lots were thumbnails otherwise). */
    const a4 = ui.paper === "a4";
    const titleW = a4 ? 0 : titlePanelWidth(sheet.boxW);
    const elevH =
      (ui.sheetElevOn ? 56 * 2 + 34 : 0) + (a4 ? SHEET_TITLE_STRIP_H : 0);
    const plot = plotBoxFor(sheet, { titleW, elevH });
    const view = sheetContentView({
      boundary: studio.boundary,
      building: studio.building,
      scaleM,
      boardW: boardSize.w,
      boardH: boardSize.h,
      plot,
      paper: ui.paper,
      sheetW: sheet.boxW,
      scaleDenom: ui.sheetScaleDenom,
    });
    return {
      plot,
      view,
      clipPath: `inset(${plot.boxTop}px ${Math.max(0, boardSize.w - plot.boxLeft - plot.boxW)}px ${Math.max(0, boardSize.h - plot.boxTop - plot.boxH)}px ${plot.boxLeft}px)`,
    };
  }, [
    ui.frameOn,
    ui.paper,
    ui.sheetElevOn,
    ui.sheetScaleDenom,
    boardSize.w,
    boardSize.h,
    studio.boundary,
    studio.building,
    scaleM,
  ]);

  /**
   * Absolute camera zoom on free plan and Fit sheet (0.05–64).
   * Fit sheet seeds ui.zoom to the paper-fit value on enter; pan centres the lot.
   */
  const planZoom = clampZoom(ui.zoom);
  const planFocusX = sheetPlotLayout?.view.focusX ?? ui.focusX;
  const planFocusY = sheetPlotLayout?.view.focusY ?? ui.focusY;
  /** Sheet centres the lot; ui.pan is extra drag on free plan and Fit sheet. */
  const planPanX = (sheetPlotLayout?.view.panX ?? 0) + ui.panX;
  const planPanY = (sheetPlotLayout?.view.panY ?? 0) + ui.panY;
  /**
   * CAD camera rotation — viewport only (geometry % coords unchanged).
   * Off on Sketch / Fit / non-CAD so survey-grade print stays north-up.
   */
  const planRotateDeg =
    ui.mode === "cad" && !ui.frameOn && !ui.clientView
      ? normalizeViewRotationDeg(ui.viewRotationDeg)
      : 0;
  /**
   * Live camera matching `.zoomWorld` — passed to any overlay that portals
   * frosted chrome via `CameraChrome` so those elements stay clear of the
   * camera transform (constant screen size, no pan/rotate leak) while the
   * underlying geometry rides the world scale.
   */
  const planCam = boardCameraFromPlan({
    boardW: boardSize.w,
    boardH: boardSize.h,
    planZoom,
    planRotateDeg,
    planPanX,
    planPanY,
    planFocusX,
    planFocusY,
  });
  /**
   * Free-plan paper stays OUTSIDE the camera transform. Scaling parchment
   * inside `.zoomWorld` made the cream board grow/shrink with the lot on
   * every wheel tick (the reported Sketch/CAD oscillation). Bleed owns the
   * fixed paper+mesh; world ground is hidePaper whenever Fit is off.
   */
  const worldHidePaper = planOn && !ui.frameOn;

  /**
   * Seed the honest print scale when opening Fit sheet / changing paper.
   * Auto = rawDenom snapped up the standard ladder, so the operator clicks
   * A3/A4 and gets a true, filled sheet with zero fiddling. Alt+wheel then
   * overrides along the ladder until the next paper/entry reseed.
   */
  const autoDenomKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ui.frameOn || !sheetPlotLayout) {
      autoDenomKeyRef.current = null;
      return;
    }
    const key = `${ui.paper}:${boardSize.w}x${boardSize.h}`;
    if (autoDenomKeyRef.current === key) return;
    autoDenomKeyRef.current = key;
    const auto = sheetPlotLayout.view.autoDenom;
    if (auto !== ui.sheetScaleDenom) {
      studio.setUi({ sheetScaleDenom: auto });
    }
  }, [
    ui.frameOn,
    ui.paper,
    ui.sheetScaleDenom,
    boardSize.w,
    boardSize.h,
    sheetPlotLayout,
    studio,
  ]);

  /** Seed absolute zoom to the current 1:N whenever format or denom changes. */
  const fitSeedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ui.frameOn || !sheetPlotLayout) {
      fitSeedKeyRef.current = null;
      return;
    }
    const key = `${ui.paper}:${ui.sheetScaleDenom}:${boardSize.w}x${boardSize.h}`;
    if (fitSeedKeyRef.current === key) return;
    fitSeedKeyRef.current = key;
    studio.setUi({
      zoom: clampZoom(sheetPlotLayout.view.zoom),
      panX: 0,
      panY: 0,
    });
  }, [
    ui.frameOn,
    ui.paper,
    ui.sheetScaleDenom,
    boardSize.w,
    boardSize.h,
    sheetPlotLayout,
    studio,
  ]);

  const setFitSheetOn = useCallback(
    (on: boolean) => {
      if (on) {
        fitSeedKeyRef.current = null;
        autoDenomKeyRef.current = null;
        /* Denom is auto-seeded from the true fit (autoDenom effect) —
           no hardcoded 1:100. */
        studio.setUi({
          frameOn: true,
          panX: 0,
          panY: 0,
        });
        return;
      }
      // Leaving Fit sheet — restore a coherent free-plan camera on every tab.
      outdoorFitKeyRef.current = null;
      fitSeedKeyRef.current = null;
      studio.setUi({ frameOn: false, panX: 0, panY: 0, zoom: 1 });
      studio.fitOutdoorView();
    },
    [studio],
  );

  /** Leaving CAD (or Fit/client) — park camera at north so Sketch stays clean. */
  useEffect(() => {
    if (ui.mode === "cad" && !ui.frameOn && !ui.clientView) return;
    if (ui.viewRotationDeg === 0) return;
    studio.setUi({ viewRotationDeg: 0 });
  }, [ui.mode, ui.frameOn, ui.clientView, ui.viewRotationDeg, studio]);

  const [formalizing, setFormalizing] = useState(false);

  /** Single authority for mode + `?mode=` URL — never setMode alone. */
  const syncModeUrl = useCallback(
    (mode: StudioMode) => {
      studio.setMode(mode);
      const next = new URLSearchParams(searchParams.toString());
      next.set("mode", mode);
      window.history.replaceState(
        window.history.state,
        "",
        `${pathname}?${next.toString()}`,
      );
    },
    [studio, searchParams, pathname],
  );

  /**
   * Sketch → CAD: rasterize the raw freehand ink and run the Claude vision
   * pipeline server-side, then apply the returned CAD elements as reviewable
   * ghosts. Falls back to the local heuristic when the network / model fails.
   */
  const runFormalizeToCad = useCallback(async () => {
    if (formalizing) return;
    if (studio.strokes.length === 0) {
      syncModeUrl("cad");
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
  }, [formalizing, studio, boardSize.w, boardSize.h, projectId, scaleM, syncModeUrl]);

  const requestMode = useCallback(
    (mode: (typeof MODE_TABS)[number]) => {
      /*
       * Changing mode EXITS the Fit sheet first — switching tabs while
       * frameOn left the studio in a half-state (sheet clip + seeded zoom
       * with no sheet chrome). Same clean path as toggling Fit off.
       */
      if (ui.frameOn) setFitSheetOn(false);
      if (ui.mode === "sketch" && mode === "cad" && studio.strokes.length > 0) {
        const alreadyHasSketchGhosts = studio.items.some(
          (i) => i.ghost && i.id.startsWith("ai-sketch-"),
        );
        if (!alreadyHasSketchGhosts) {
          void runFormalizeToCad();
          return;
        }
      }
      syncModeUrl(mode);
    },
    [ui.mode, ui.frameOn, setFitSheetOn, studio, runFormalizeToCad, syncModeUrl],
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

  const selectedLive =
    studio.items.find((i) => i.id === ui.selectedId && !i.ghost) ?? null;

  /** Single-selection orbit (dial) — also drives the focus veil. */
  const selectionOrbitOn = Boolean(
    !ui.clientView &&
      !ui.frameOn &&
      !isTiltActive(ui.tiltDeg) &&
      selectedLive &&
      ui.groupIds.length <= 1 &&
      ui.tool !== "zone" &&
      (ui.mode === "cad" || ui.mode === "survey"),
  );

  /** One-time dial discoverability (session). */
  useEffect(() => {
    if (dialHintSeenRef.current) return;
    if (!selectedLive || ui.frameOn || isTiltActive(ui.tiltDeg)) return;
    if (ui.mode !== "cad" && ui.mode !== "survey") return;
    if (ui.groupIds.length > 1) return;
    dialHintSeenRef.current = true;
    try {
      if (window.localStorage.getItem("ws-dial-hint-seen") === "1") return;
      window.localStorage.setItem("ws-dial-hint-seen", "1");
    } catch {
      /* ignore */
    }
    setDialHint(true);
  }, [selectedLive, ui.frameOn, ui.tiltDeg, ui.mode, ui.groupIds.length]);

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
    ui.tool !== "select" ||
    Boolean(ui.drawPoly && ui.drawPoly.length > 0) ||
    Boolean(ui.selectedId) ||
    ui.groupIds.length > 0 ||
    ui.addOpen ||
    ui.locked;
  const quoteShareLines = useMemo(
    () =>
      estimate.lines
        .filter((l) => l.total > 0)
        .slice(0, 18)
        .map((l) => ({
          id: l.id,
          label: l.label,
          unit: l.unit,
          qty: l.qty,
          total: l.total,
        })),
    [estimate.lines],
  );
  const hasCostedBom =
    quoteShareLines.length > 0 && estimate.totalInclGst > 0;

  const modeProgress = useMemo(
    () => ({
      hasAerial:
        Boolean(liveAerial) ||
        Boolean(ui.aerialUri) ||
        Boolean(titleBlock) ||
        studio.boundary.length >= 3,
      hasSketch: studio.items.some((i) => !i.ghost) || studio.strokes.length > 0,
      hasCad:
        studio.items.some((i) => !i.ghost) ||
        studio.strokes.length > 0 ||
        studio.irrigationZones.length > 0,
      /** Share unlocks on live costed BOM (not only persisted quote output). */
      hasQuote: hasCostedBom || quotePersisted,
    }),
    [
      hasCostedBom,
      liveAerial,
      quotePersisted,
      studio.boundary.length,
      studio.irrigationZones.length,
      studio.items,
      studio.strokes.length,
      titleBlock,
      ui.aerialUri,
    ],
  );
  const openModes = useMemo(() => unlockedModes(modeProgress), [modeProgress]);
  const fallbackMode = useMemo(() => suggestedMode(modeProgress), [modeProgress]);

  useEffect(() => {
    if (!openModes.has(ui.mode)) {
      requestMode(fallbackMode);
    }
  }, [fallbackMode, openModes, requestMode, ui.mode]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { listShareRevisionsAction } = await import(
          "../../../app/actions"
        );
        const data = await listShareRevisionsAction(projectId);
        if (!cancelled) setLatestShare(data.revisions[0] ?? null);
      } catch {
        /* non-blocking — share stamp is progressive */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const openSharedRev =
    latestShare?.status === "shared" ? latestShare : null;

  const lockReasonForMode = (mode: StudioMode): string | null => {
    if (openModes.has(mode)) return null;
    if (mode === "sketch" || mode === "cad" || mode === "elevation") {
      return "Complete survey and title boundary first.";
    }
    if (mode === "quote") return "Accept CAD geometry before quoting.";
    if (mode === "share") return "Cost something on the drawing before sharing.";
    return "Complete the previous stage first.";
  };
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
        tool: "select",
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
        sketchTool: ui.mode === "sketch" ? sketchChrome.tool : undefined,
        sketchTip: ui.mode === "sketch" ? sketchChrome.tip : undefined,
      });

  /** Drag-to-pan takes cursor priority over whatever tool is active. */
  const effectiveCursor = isPanningActive
    ? "grabbing"
    : spacePanArmed
      ? "grab"
      : studioCursor;

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
      className={`${css.root}${darkLens ? ` ${css.rootDark}` : ""}${ui.focusOn ? ` ${css.rootFocus}` : ""}${ui.clientView ? ` ${css.rootClient}` : ""}${precisionOn ? ` ${css.rootPrecision}` : ""}`}
      data-testid="handoff-design-studio"
      data-canvas-mode={ui.mode}
      data-studio-surface="handoff-v4"
      data-compliance={compliance.canvasSignal}
      data-fit-sheet={ui.frameOn ? "1" : "0"}
      data-paper={ui.paper}
      data-right-lane={rightLaneBusy ? "1" : "0"}
      style={
        {
          /* Must match .zoomWorld scale (planZoom), not raw ui.zoom —
             Fit sheet diverges via sheetContentView. Inverse handles depend on it. */
          ["--studio-zoom" as string]: String(planZoom),
          ...(rightLaneBusy
            ? {
                ["--ws-safe-right" as string]: `${RIGHT_DATA_LANE_WIDTH_PX}px`,
              }
            : null),
          ...(printSheet
            ? {
                ["--ws-print-left" as string]: `${printSheet.left}px`,
                ["--ws-print-top" as string]: `${printSheet.top}px`,
                ["--ws-print-fit" as string]: String(printSheet.fit),
                ["--ws-paper-w" as string]: `${printSheet.paperW}px`,
                ["--ws-paper-h" as string]: `${printSheet.paperH}px`,
                ["--ws-board-w" as string]: `${printSheet.boardW}px`,
                ["--ws-board-h" as string]: `${printSheet.boardH}px`,
              }
            : null),
        } as CSSProperties
      }
    >
      {printSheet ? (
        <style>
          {`@page { size: ${
            printSheet.paper === "a4" ? "A4 portrait" : "A3 landscape"
          }; margin: 0; }`}
        </style>
      ) : null}
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
          {/* Survey/services is a layer on the CAD canvas (Services toggle),
              not a separate tab. Canvas-first: one canvas, dynamic. */}
          {MODE_TABS.filter((m) => m !== "survey").map((m) => {
            const lockReason = lockReasonForMode(m);
            const locked = Boolean(lockReason);
            return (
              <button
                key={m}
                type="button"
                className={`${css.modeBtn}${ui.mode === m ? ` ${css.modeBtnActive}` : ""}${locked ? ` ${css.modeBtnLocked}` : ""}`}
                data-testid={`canvas-mode-${m}`}
                disabled={locked}
                aria-disabled={locked}
                aria-current={ui.mode === m ? "page" : undefined}
                title={lockReason ?? `${m[0]!.toUpperCase() + m.slice(1)} mode`}
                onClick={() => {
                  if (!locked) requestMode(m);
                }}
              >
                {locked ? <span className={css.modeLockIcon} aria-hidden /> : null}
                {m[0]!.toUpperCase() + m.slice(1)}
              </button>
            );
          })}
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
            className={`${css.iconBtn}${instrumentsSummoned ? ` ${css.iconBtnActive}` : ""}`}
            data-testid="pointer-settings-top"
            aria-label="Open instruments and pointer mark"
            title="Instruments — pointer mark lives with the tool dock"
            onClick={() => {
              setInstrumentsSummoned(true);
            }}
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
            onClick={() => setFitSheetOn(!ui.frameOn)}
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
                className={`${css.iconBtn}${layersOpen ? ` ${css.iconBtnActive}` : ""}`}
                data-testid="canvas-layers-top"
                aria-label="Layers"
                title="Layers"
                onClick={() =>
                  studio.setUi({
                    rightDataPanel: toggleRightDataPanel(
                      ui.rightDataPanel,
                      "layers",
                    ),
                    utilityPanel: null,
                  })
                }
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
                className={`${css.iconBtn}${sitesOpen ? ` ${css.iconBtnActive}` : ""}`}
                data-testid="canvas-sites-top"
                aria-label="Sites"
                title="Sites"
                onClick={() =>
                  studio.setUi({
                    rightDataPanel: toggleRightDataPanel(
                      ui.rightDataPanel,
                      "sites",
                    ),
                    utilityPanel: null,
                  })
                }
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
          {ui.mode === "cad" && !ui.focusOn && !ui.clientView ? (
            <button
              type="button"
              className={`${css.iconBtn}${ui.servicesEdit ? ` ${css.iconBtnActive}` : ""}`}
              data-testid="services-layer-top"
              aria-label={
                ui.servicesEdit ? "Close services layer" : "Services layer"
              }
              title="Services layer — drainage, utilities, RL levels, calibrate"
              aria-pressed={ui.servicesEdit}
              onClick={() =>
                studio.setUi({
                  servicesEdit: !ui.servicesEdit,
                  tool: ui.servicesEdit ? "select" : "service",
                  layerOpacity: { ...ui.layerOpacity, services: 1 },
                })
              }
            >
              <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M1.5 6.5h3l2 4 2.4-8 1.6 5.5 1-1.5h2.5"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            </button>
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
            <div className={css.shareWrap}>
              <button
                type="button"
                className={`${css.iconBtn}${sharePopupOpen || ui.mode === "share" ? ` ${css.iconBtnActive}` : ""}`}
                data-testid="share-top"
                aria-label="Share"
                aria-expanded={sharePopupOpen}
                title={
                  lockReasonForMode("share") ??
                  (hasCostedBom
                    ? "Share with client"
                    : "Cost something before sharing")
                }
                disabled={!hasCostedBom}
                onClick={() => {
                  if (!hasCostedBom) return;
                  setSharePopupOpen((v) => !v);
                }}
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
              <ShareRevisionPopup
                open={sharePopupOpen}
                onClose={() => setSharePopupOpen(false)}
                projectId={projectId}
                address={displayAddress}
                quoteLines={quoteShareLines}
                totalInclGst={estimate.totalInclGst}
                onRevisionChange={setLatestShare}
              />
            </div>
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
          <CanvasAutosaveChip
            status={ui.saveStatus}
            savedTick={ui.savedTick}
            revision={ui.saveRevision}
            onSave={() => {
              void studio.saveNow().catch(() => {
                toast.show(
                  "Canvas save failed. Try again before leaving.",
                  "error",
                );
              });
            }}
            onRetry={() => {
              void studio.saveNow().catch(() => {
                toast.show(
                  "Canvas save failed. Try again before leaving.",
                  "error",
                );
              });
            }}
          />
        </div>
      </header>

      {openSharedRev && !ui.clientView ? (
        <p className={css.shareBanner} data-testid="share-open-banner">
          Shared rev {openSharedRev.revision} is out with the client — changes
          create a new revision.
        </p>
      ) : null}

      {!ui.clientView && !ui.frameOn && planOn ? (
        <StudioContextBreadcrumb
          mode={ui.mode}
          isolatedLayer={ui.isolatedLayer}
          layerOpacity={ui.layerOpacity}
          setbackOn={ui.setbackOn}
          shadeOn={ui.shadeOn}
          growth={ui.growth}
          onClearIsolation={() => studio.setUi({ isolatedLayer: null })}
          onClearSetback={() => studio.setUi({ setbackOn: false })}
          onClearShade={() => studio.setUi({ shadeOn: false, sunPlay: false })}
          onResetGrowth={() => studio.setUi({ growth: "mature" })}
          onResetLayer={(layer) => studio.setLayerOpacity(layer, 1)}
        />
      ) : null}

      <div
        className={`${css.board}${compliance.canvasSignal === "critical" ? ` ${css.boardCritical}` : ""}${compliance.canvasSignal === "watch" ? ` ${css.boardWatch}` : ""}${isTiltActive(ui.tiltDeg) || tiltAnimKind ? ` ${css.boardTiltPerspective}` : ""}`}
        data-testid="studio-board"
        data-panning={isPanningActive ? "1" : "0"}
        data-tilt={isTiltActive(ui.tiltDeg) ? "1" : "0"}
        data-focus-veil={selectionOrbitOn ? "1" : "0"}
        ref={boardRef}
        style={{ cursor: effectiveCursor }}
      >
        {/* Fit sheet / Sketch margin own their own legal line. */}
        {!ui.frameOn && ui.mode !== "sketch" ? (
          <div className={css.honestyCaption}>
            Concept sketch for estimating — not a construction drawing.
          </div>
        ) : null}
        {ui.mode === "elevation" ? (
          <ElevationBoard
            axis={ui.elevAxis}
            boundary={studio.boundary}
            building={studio.building}
            items={studio.items}
            selectedId={ui.selectedId}
            dark={darkLens}
            onSelect={(id) => studio.setUi({ selectedId: id })}
            onToggleAxis={() =>
              studio.setUi({ elevAxis: ui.elevAxis === "x" ? "y" : "x" })
            }
            onTraceInPlan={(id) => {
              studio.setUi({ selectedId: id });
              requestMode("cad");
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
              requestMode("cad");
              ai.openReview();
            }}
            onShare={() => {
              setSharePopupOpen(true);
            }}
            onBack={() => requestMode("cad")}
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
              requestMode("cad");
              ai.openReview();
            }}
            onBack={() => requestMode("cad")}
            onOpenSharePopup={() => {
              setSharePopupOpen(true);
              requestMode("cad");
            }}
          />
        ) : null}

        {planOn ? (
          <>
            {!ui.frameOn ? (
              <div
                className={css.parchmentBleed}
                data-testid="parchment-bleed"
                aria-hidden
              >
                <TactileGround
                  zoom={planZoom}
                  sheetScaleDenom={100}
                  parchmentPeel={
                    draftingPlate || ui.foundationCleanse ? 1 : ui.parchmentPeel
                  }
                  hasAerial={Boolean(liveAerial)}
                  darkOn={darkLens}
                  foundationCleanse={ui.foundationCleanse}
                  titleLocked={titleLocked}
                  boundarySource={ui.boundarySource}
                  siteLabel={displayAddress}
                  address={displayAddress}
                  suppressSiteCue
                  quietChrome
                  showEdgeLabels={false}
                />
              </div>
            ) : null}
          <div
            className={
              sheetPlotLayout
                ? `${css.sheetPlotClip}`
                : undefined
            }
            style={
              sheetPlotLayout
                ? { clipPath: sheetPlotLayout.clipPath }
                : undefined
            }
          >
            <div
              className={`${css.zoomWorld}${isTiltActive(ui.tiltDeg) || tiltAnimKind ? ` ${css.zoomWorldTilted}` : ""}${tiltAnimKind === "fast" ? ` ${css.zoomWorldTiltAnim}` : ""}${tiltAnimKind === "slow" ? ` ${css.zoomWorldTiltAnimSlow}` : ""}`}
              data-testid="zoom-world"
              data-print-keep="plan"
              data-tilt-deg={ui.tiltDeg.toFixed(1)}
              onTransitionEnd={(e) => {
                if (e.propertyName !== "transform") return;
                clearTiltAnimKind();
              }}
              onTransitionCancel={(e) => {
                if (e.propertyName !== "transform") return;
                clearTiltAnimKind();
              }}
              style={{
                transformOrigin: `${planFocusX}% ${planFocusY}%`,
                /*
                 * Camera: optional view-only tilt → pan → rotate → scale.
                 * Keep rotateX(0) in the string while the temp transition class
                 * is on so flatten animates (then strip for pixel-identical off).
                 * Tilt is never inverted in clientToBoardPct — editing locks out.
                 */
                transform: `${
                  isTiltActive(ui.tiltDeg) || tiltAnimKind
                    ? `rotateX(${ui.tiltDeg}deg) `
                    : ""
                }translate(${planPanX}px, ${planPanY}px) rotate(${planRotateDeg}deg) scale(${planZoom})`,
                cursor: effectiveCursor,
              }}
            >
            <AerialSlot
              uri={liveAerial}
              dimmed={darkLens}
              frameOn={ui.frameOn}
              scanning={
                aerialOk &&
                (ui.canopyScanning || ai.busy === "scanning")
              }
              zoom={planZoom}
              sheetScaleDenom={100}
              darkOn={darkLens}
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
              hidePaper={worldHidePaper}
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
              datePreset={ui.sunDatePreset}
              lat={projectLat ?? undefined}
              lng={projectLng ?? undefined}
            />
            <CadPlanBoard
              frameOn={ui.frameOn}
              darkOn={darkLens}
              foundationCleanse={ui.foundationCleanse}
              titleLocked={titleLocked}
              titleBoundaryLocked={ui.titleBoundaryLocked}
              buildingSource={ui.buildingSource}
              scaleM={scaleM}
              planZoom={planZoom}
              tiltDeg={ui.tiltDeg}
              planPanX={planPanX}
              planPanY={planPanY}
              planFocusX={planFocusX}
              planFocusY={planFocusY}
              planRotateDeg={planRotateDeg}
              lotAreaM2={
                /* Cadastral only — drawn-lot fallback lives in
                   resolveDisplayLotM2 (outdoor is not a Title figure). */
                titleBlock?.lotAreaM2 ?? null
              }
              siteAreas={
                siteSchedule
                  ? {
                      buildingAreaM2: siteSchedule.buildingAreaM2,
                      outdoorAreaM2: siteSchedule.outdoorAreaM2,
                    }
                  : null
              }
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
              tool={ui.foundationCleanse && !ui.titleBoundaryLocked ? "select" : ui.tool}
              locked={ui.foundationCleanse ? false : ui.locked}
              layerOpacity={ui.layerOpacity}
              isolatedLayer={ui.isolatedLayer}
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
              onMarqueeSelect={(ids, opts) => {
                setInstrumentsSummoned(false);
                if (opts?.additive && ids.length > 0) {
                  const merged = new Set([...ui.groupIds, ...ids]);
                  if (ui.selectedId) merged.add(ui.selectedId);
                  const list = [...merged];
                  studio.setSelection(ids[0] ?? ui.selectedId, list);
                  return;
                }
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
                requestMode("elevation");
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
              previewSwatch={previewSwatch}
              eyedropArmed={eyedropArmed}
              onEyedrop={pickStyle}
              onBoardCursor={setBoardCursor}
              onInertToolClick={onInertToolClick}
              fidelity={fidelity}
              onInteract={markInteracting}
              annotations={studio.annotations}
              selectedAnnotationId={selectedAnnotationId}
              onSelectAnnotation={(id) => {
                setSelectedAnnotationId(id);
                if (id) studio.setSelection(null, []);
              }}
              onMoveAnnotation={(id, notePos) => {
                studio.updateAnnotationNotePos(
                  id,
                  clampNotePos(notePos, studio.boundary),
                );
              }}
              annotatePlace={annotatePhase === "place"}
              onAnnotatePlace={({ x, y, itemId }) => {
                const anchor: CanvasAnnotation["anchor"] = itemId
                  ? { kind: "item", itemId }
                  : { kind: "point", x, y };
                const notePos = defaultNotePos(x, y, studio.boundary);
                setPendingAnnotation({ anchor, notePos });
                setAnnotateDraft("");
                setAnnotatePhase("type");
              }}
            />
            {annotatePhase === "type" && pendingAnnotation ? (
              <div
                className={css.annotateInputWrap}
                data-testid="annotate-input"
                style={{
                  left: `${pendingAnnotation.notePos.x}%`,
                  top: `${pendingAnnotation.notePos.y}%`,
                }}
              >
                <input
                  autoFocus
                  type="text"
                  maxLength={140}
                  value={annotateDraft}
                  placeholder="NOTE…"
                  aria-label="Annotation text"
                  style={{ fontSize: 16 }}
                  onChange={(e) => setAnnotateDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setAnnotatePhase("off");
                      setPendingAnnotation(null);
                      setAnnotateDraft("");
                      return;
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      const text = annotateDraft.trim();
                      if (!text) return;
                      const ann: CanvasAnnotation = {
                        id: crypto.randomUUID(),
                        text,
                        anchor: pendingAnnotation.anchor,
                        notePos: pendingAnnotation.notePos,
                        createdAt: new Date().toISOString(),
                      };
                      studio.addAnnotation(ann);
                      setSelectedAnnotationId(ann.id);
                      setAnnotatePhase("off");
                      setPendingAnnotation(null);
                      setAnnotateDraft("");
                      void studio.saveNow().catch(() => {
                        /* autosave chip surfaces failure */
                      });
                    }
                  }}
                />
              </div>
            ) : null}
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
                cam={planCam}
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
            {/* VolumetricIsolith + AmbientBudgetMargin render outside .zoomWorld */}
            {ui.mode === "sketch" ? (
              <SketchBoard
                strokes={studio.strokes}
                darkOn={darkLens}
                hideChrome={ui.frameOn}
                formalizing={formalizing}
                active={ui.tool === "sketch"}
                onActivate={() => studio.setTool("sketch")}
                onChromeChange={onSketchChromeChange}
                onCommit={(stroke) => {
                  studio.setStrokes([...studio.strokes, stroke]);
                }}
                onErase={(strokeId) =>
                  studio.setStrokes(
                    studio.strokes.filter((stroke) => stroke.id !== strokeId),
                  )
                }
                onUndoLast={() => studio.undo()}
                onRedo={() => studio.redo()}
                canUndo={studio.canUndo}
                canRedo={studio.canRedo}
                onTidy={() => studio.tidySketches()}
                onFormalizeToCad={() => {
                  void runFormalizeToCad();
                }}
              />
            ) : null}
            {ui.mode === "cad" && studio.strokes.length > 0 ? (
              <SketchBoard
                readOnly
                strokes={studio.strokes}
                darkOn={darkLens}
              />
            ) : null}
            {planOn && !ui.frameOn ? (
              <>
                <SurveyAnnotationLayer
                  active={
                    ui.mode === "survey" ||
                    (ui.mode === "cad" && ui.servicesEdit)
                  }
                  tool={ui.tool}
                  levels={studio.levels}
                  services={studio.services}
                  easements={studio.easements}
                  showCorridors={ui.mode === "survey"}
                  scaleM={scaleM}
                  darkOn={darkLens}
                  layerOpacity={ui.layerOpacity}
                  isolatedLayer={ui.isolatedLayer}
                  onAddLevel={studio.addSpotLevel}
                  onCommitService={studio.commitService}
                  onCalibrate={(nextScaleM) => {
                    // Prototype: board width metres from two known points.
                    // Also snap sheet denom so the ground mesh stays coherent.
                    const denoms = SHEET_SCALE_STEPS;
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
                      tool: "select",
                    });
                  }}
                />
              </>
            ) : null}
            <TraceOverlay
              active={ui.tool === "trace" && !ui.frameOn && ui.mode !== "sketch"}
              locked={ui.locked}
              target={ui.traceTarget}
              drawPoly={ui.drawPoly}
              drawCursor={ui.drawCursor}
              cam={planCam}
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
              cam={planCam}
              onCancel={() => {
                studio.setTool("select");
                setInstrumentsSummoned(false);
              }}
            />
            {(ui.mode === "cad" || ui.mode === "sketch") && !ui.frameOn ? (
              <ZoneOverlay
                active={ui.tool === "zone"}
                kind={ui.zoneKind}
                zones={studio.irrigationZones}
                cam={planCam}
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
                cam={planCam}
                onSelect={(tool: NicheTool) => {
                  if (tool.id === "zone-drip") {
                    studio.setUi({ zoneKind: "drip" });
                  } else if (tool.id === "zone-lighting") {
                    studio.setUi({ zoneKind: "lighting" });
                  }
                }}
              />
            ) : null}
            {gridStudioOpen &&
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
                cam={planCam}
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
            {/* Selection focus veil — one scrim; persists across item hops. */}
            {selectionOrbitOn && selectedLive ? (
              <SelectionFocusVeil
                focusPct={{ x: selectedLive.x, y: selectedLive.y }}
                cam={planCam}
                night={darkLens}
                onDismiss={() => studio.setSelection(null, [])}
              />
            ) : null}
            {/* Selection dial — steering-wheel arc (single item, plan modes). */}
            {selectionOrbitOn && selectedLive ? (
              <SelectionDial
                item={selectedLive}
                items={studio.items}
                cam={planCam}
                night={darkLens}
                onTransform={studio.transformItem}
                onChangeType={studio.changeSelectedType}
                onDuplicate={studio.duplicateSelected}
                onAnnotate={() => {
                  setAnnotatePhase("place");
                  setPendingAnnotation(null);
                  setAnnotateDraft("");
                }}
                onDelete={() => {
                  const id = selectedLive.id;
                  studio.deleteSelected();
                  toast.show("Deleted", "info", 5000, {
                    action: {
                      label: "Undo",
                      onClick: () => studio.undo(),
                    },
                  });
                  void id;
                }}
                onDismiss={() => studio.setSelection(null, [])}
              />
            ) : null}
            {/* Multi-select / sketch keep the orbit ring; single CAD uses dial. */}
            {!ui.clientView &&
            selectedLive &&
            ui.tool !== "zone" &&
            !selectionOrbitOn &&
            (chrome.selectionRing ||
              ui.mode === "cad" ||
              ui.mode === "sketch" ||
              ui.mode === "survey") ? (
              <SelectionRing
                item={selectedLive}
                xPct={selectedLive.x}
                yPct={selectedLive.y}
                locked={ui.locked}
                cam={planCam}
                onDelete={studio.deleteSelected}
                onClose={() => studio.setSelection(null, [])}
                onLock={() => studio.setTool(ui.locked ? "select" : "lock")}
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
                cam={planCam}
              />
            ) : null}
            {/* AmbientBudgetMargin outside .zoomWorld */}
            </div>
          </div>
          {/* Dedicated portal mount — sibling of the camera, never an ancestor
              of chrome call-sites. Portaling into an ancestor collapses wrappers.
              NOT aria-hidden: CameraChrome portals interactive chrome (tool
              dock, checklist, measures, hint pills) into this node — hiding it
              removed every docked control from the accessibility tree. */}
          <div
            data-testid="camera-chrome-root"
            data-camera-chrome-root="1"
            className={css.cameraChromeRoot}
          />
          </>
        ) : null}

        {planOn && !ui.frameOn ? (
          <GroundRulerOverlay
            zoom={planZoom}
            focusX={planFocusX}
            focusY={planFocusY}
            panXPct={boardSize.w > 0 ? (ui.panX / boardSize.w) * 100 : 0}
            panYPct={boardSize.h > 0 ? (ui.panY / boardSize.h) * 100 : 0}
            sheetScaleDenom={100}
            darkOn={darkLens}
          />
        ) : null}

        {planOn &&
        !ui.frameOn &&
        ui.mode === "survey" &&
        !ui.focusOn &&
        !ui.clientView &&
        checklistOpen ? (
          <RightDataLane testId="right-data-lane-checklist">
            <SurveyChecklist
              boundary={studio.boundary}
              building={studio.building}
              items={studio.items}
              levels={studio.levels}
              services={studio.services}
              easements={studio.easements}
              onClose={() => studio.setUi({ rightDataPanel: null })}
            />
          </RightDataLane>
        ) : null}

        {planOn && chrome.volumeIsolith ? (
          <VolumetricIsolith
            estimate={estimate}
            proximity={
              drawingHot &&
              (ui.armed === "paving" || ui.armed === "deck")
            }
          />
        ) : null}

        {planOn && chrome.tradeMargin ? (
          <AmbientBudgetMargin
            trade={trade}
            displayTotalInclGst={estimate.totalInclGst}
          />
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
            scaleM={scaleM}
            showElevations={ui.sheetElevOn}
            scaleDenom={ui.sheetScaleDenom}
            onScaleDenom={(sheetScaleDenom) => studio.setUi({ sheetScaleDenom })}
            titleBlock={titleBlock}
            shareStamp={
              latestShare
                ? latestShare.status === "accepted"
                  ? `Rev ${latestShare.revision} · Accepted`
                  : latestShare.status === "declined"
                    ? `Rev ${latestShare.revision} · Declined`
                    : latestShare.status === "shared"
                      ? `Rev ${latestShare.revision} · Shared ${new Date(
                          latestShare.created_at,
                        ).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}`
                      : `Rev ${latestShare.revision} · Superseded`
                : null
            }
          />
        ) : null}

        {ui.mode === "cad" && !ui.frameOn && !ui.clientView && !ui.focusOn ? (
          <ViewNorthControl
            rotationDeg={ui.viewRotationDeg}
            stepDeg={ui.viewRotationStepDeg}
            onRotation={(viewRotationDeg) => studio.setUi({ viewRotationDeg })}
            onStep={(viewRotationStepDeg: ViewRotationStepDeg) =>
              studio.setUi({ viewRotationStepDeg })
            }
          />
        ) : null}

        {tiltDiscoverHint && planOn && !ui.frameOn ? (
          <TiltHintPill
            kind="discover"
            onDismiss={() => setTiltDiscoverHint(false)}
          />
        ) : null}
        {tiltPauseHint && planOn && !ui.frameOn ? (
          <TiltHintPill
            kind="paused"
            onDismiss={() => setTiltPauseHint(false)}
          />
        ) : null}

        {chrome.ambientRibbon ? (
          <ToolDock
            tool={ui.tool}
            mode={ui.mode}
            servicesEdit={ui.mode === "cad" && ui.servicesEdit}
            locked={ui.locked}
            night={darkLens}
            gridOn={gridStudioOpen}
            onTool={(t) => {
              studio.setTool(t);
            }}
            onMeasure={() => {
              studio.setTool(ui.tool === "measure" ? "select" : "measure");
            }}
            onToggleGrid={() => setGridStudioOpen((v) => !v)}
          />
        ) : null}

        {dialHint && planOn && !ui.frameOn ? (
          <DialHintPill onDismiss={() => setDialHint(false)} />
        ) : null}

        {selectHint && planOn && !ui.frameOn ? (
          <DialHintPill
            label="Drop the tool to select — Esc"
            testId="select-hint"
            onDismiss={() => setSelectHint(false)}
          />
        ) : null}

        {/*
          Inventory frost popup — fold-out asset library (search + Draft kit
          + catalog categories). Add-only: placing assets summons the popup at
          the cursor. Fill swatches summon beside the tool dock on Add/Paint.
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
            onDismiss={() => studio.setTool("select")}
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

        {/* Formalize payoff — a scan beam sweeps the board while the sketch
            is being translated to CAD. Chrome, never inside the zoom world. */}
        {formalizing ? (
          <CameraChrome
            place={{ kind: "dock" }}
            zIndex={53}
            testId="formalize-sweep-chrome"
            contentPointerEvents="none"
          >
            <div
              className={css.formalizeSweep}
              data-testid="formalize-sweep"
              aria-hidden
            >
              <div className={css.formalizeBeam} />
            </div>
          </CameraChrome>
        ) : null}

        {/* Lane law: this compact chip and the right data lane share the
            same top-right corner — hide it whenever ANY lane occupant
            (checklist/layers/sites/measures) is open, not just "measures",
            so it never visually collides with the open panel below it. */}
        {!rightLaneBusy &&
        planOn &&
        !ui.focusOn &&
        !ui.clientView &&
        !ui.frameOn &&
        !ui.foundationCleanse ? (
          <CameraChrome
            place={{ kind: "dock" }}
            zIndex={52}
            testId="canvas-measure-summary-chrome"
          >
            <CanvasMeasureSummary
              mode={ui.mode}
              boundary={studio.boundary}
              building={studio.building}
              items={studio.items}
              scaleM={scaleM}
              schedule={siteSchedule}
              selected={selectedLive}
              onOpen={() =>
                studio.setUi({
                  rightDataPanel: "measures",
                  utilityPanel: null,
                })
              }
            />
          </CameraChrome>
        ) : null}

        {measuresOpen &&
        planOn &&
        !ui.focusOn &&
        !ui.clientView &&
        !ui.frameOn &&
        !ui.foundationCleanse ? (
          <RightDataLane testId="right-data-lane-measures">
            <LiveMeasuresRail
              boundary={studio.boundary}
              building={studio.building}
              items={studio.items}
              scaleM={scaleM}
              schedule={siteSchedule}
              selected={selectedLive}
              onClose={() =>
                studio.setUi({ rightDataPanel: null, utilityPanel: null })
              }
            />
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
                  [
                    compliance.outdoorOk,
                    compliance.permeableOk,
                    compliance.canopyOk,
                  ].filter(Boolean).length
                }
                councilSummary={{
                  permeablePct: compliance.permeablePct,
                  canopyPct: compliance.canopyPct,
                  setbackM: compliance.setbackM,
                }}
                projectId={projectId}
                projectAddress={projectAddress}
                complianceReport={compliance}
                onClose={() =>
                  studio.setUi({ rightDataPanel: null, utilityPanel: null })
                }
                onOpenPanel={(utilityPanel) =>
                  studio.setUi({
                    utilityPanel,
                    ...(utilityPanel === "compliance"
                      ? { setbackOn: true }
                      : {}),
                  })
                }
                onMitigate={(id) =>
                  studio.setUi({
                    mitigated: { ...ui.mitigated, [id]: !ui.mitigated[id] },
                  })
                }
                onOpenQuote={() => requestMode("quote")}
                settling={
                  estimateSettling ||
                  ui.saveStatus === "saving" ||
                  ui.saveStatus === "retrying"
                }
              />
            ) : null}
          </RightDataLane>
        ) : null}

        {/* Sun scrubber is contextual — only when the operator armed shade mesh. */}
        {chrome.sunGrowth ? (
          <SunGrowthDock
            sunMin={ui.sunMin}
            datePreset={ui.sunDatePreset}
            growth={ui.growth}
            playing={ui.sunPlay}
            onSunMin={(sunMin) => studio.setUi({ sunMin })}
            onDatePreset={(sunDatePreset) => studio.setUi({ sunDatePreset })}
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
              services={studio.services}
              easements={studio.easements}
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
              rejectReasonId={ai.rejectReasonId}
              onRejectWithReason={ai.rejectWithReason}
              onCycle={ai.cycle}
              onAskAi={(id) => {
                const g = ai.pending.find((x) => x.id === id);
                void ai.assist(g?.why ?? "refine this suggestion");
              }}
            />
          </div>
        ) : null}

        {/* Right data lane — one panel (lane law). Layers no longer left. */}
        {chrome.structureRail && planOn && layersOpen ? (
          <RightDataLane testId="right-data-lane-layers">
            <LayersPanel
              open
              opacity={ui.layerOpacity}
              setbackOn={ui.setbackOn}
              shadeOn={ui.shadeOn}
              items={studio.items}
              noteCount={studio.annotations.length}
              onClose={() => studio.setUi({ rightDataPanel: null })}
              onOpacity={studio.setLayerOpacity}
              onSetback={(setbackOn) => studio.setUi({ setbackOn })}
              onShade={(shadeOn) => studio.setUi({ shadeOn })}
            />
          </RightDataLane>
        ) : null}

        {swatchTrayOn ? (
          <SwatchTray
            activeSwatch={ui.paintSwatch}
            armed={ui.tool === "paint" && !eyedropArmed}
            eyedropOn={eyedropArmed}
            night={darkLens}
            onPick={(t) => {
              setEyedropArmed(false);
              studio.setUi({ paintSwatch: t, tool: "paint" });
            }}
            onEyedrop={() => setEyedropArmed((v) => !v)}
            onPreview={setPreviewSwatch}
          />
        ) : null}

        {undoFilmOn && (studio.canUndo || studio.canRedo) ? (
          <div className={css.undoFilmstrip} data-testid="undo-filmstrip">
            <button
              type="button"
              className={css.undoFilmBtn}
              disabled={!studio.canUndo}
              onClick={studio.undo}
              title="Undo"
            >
              Undo
            </button>
            <div className={css.undoCells} aria-label="Recent canvas states">
              {Array.from({ length: Math.min(studio.undoDepth, 8) }).map((_, i) => (
                <button
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  type="button"
                  className={css.undoCell}
                  data-provenance={
                    studio.undoProvenance[
                      studio.undoProvenance.length - 1 - i
                    ] ?? "manual"
                  }
                  title={`Step back ${i + 1}`}
                  onClick={() => {
                    for (let n = 0; n <= i; n += 1) studio.undo();
                  }}
                />
              ))}
              {studio.undoDepth === 0 ? (
                <span className={css.undoEmpty}>Live</span>
              ) : null}
            </div>
            <button
              type="button"
              className={css.undoFilmBtn}
              disabled={!studio.canRedo}
              onClick={studio.redo}
              title="Redo"
            >
              Redo
            </button>
          </div>
        ) : null}

        {undoFilmOn &&
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

        {sitesOpen && planOn && !projectId ? (
          <RightDataLane testId="right-data-lane-sites">
            <SiteSwitcher
              open
              siteIdx={ui.siteIdx}
              onClose={() => studio.setUi({ rightDataPanel: null })}
              onPick={studio.switchSite}
            />
          </RightDataLane>
        ) : null}

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
          onToggleFitSheet={() => setFitSheetOn(!ui.frameOn)}
          onGoQuote={() => requestMode("quote")}
          onToggleFocus={() => studio.setUi({ focusOn: !ui.focusOn })}
          onTiltView={() => {
            const planMode =
              ui.mode === "survey" || ui.mode === "sketch" || ui.mode === "cad";
            if (!planMode || ui.frameOn) return;
            animateTiltTo(isTiltActive(ui.tiltDeg) ? 0 : TILT_DEG);
          }}
          dataOpen={measuresOpen}
          onToggleData={() =>
            studio.setUi({
              rightDataPanel: toggleRightDataPanel(
                ui.rightDataPanel,
                "measures",
              ),
              utilityPanel:
                ui.rightDataPanel === "measures"
                  ? null
                  : (ui.utilityPanel ?? "bom"),
            })
          }
          onUndo={studio.undo}
          onRedo={studio.redo}
          onAnnotate={() => {
            setSelectedAnnotationId(null);
            setPendingAnnotation(null);
            setAnnotateDraft("");
            setAnnotatePhase("place");
            studio.setUi({ cmdOpen: false, cmdQuery: "", tool: "select" });
          }}
          onZoomToFit={() => {
            studio.setUi({ cmdOpen: false, cmdQuery: "" });
            if (ui.selectedId) studio.fitSelectionView();
            else studio.fitOutdoorView();
          }}
        />

      </div>
    </div>
  );
}
