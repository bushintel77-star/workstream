"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  canvasStrokeToPathD,
  strokePointsToPathD,
  type StrokePointPct,
} from "@workstream/domain";
import {
  buildGhostPlacementSuggestions,
  buildStudioAiSuggestions,
  CATALOG_PLANNING_SYMBOL_IDS,
  isTier1WrightsTerrace,
  withDirtySaveSuggestion,
} from "@workstream/domain";
import type {
  GhostPlacementSuggestion,
  StudioAiSuggestion,
} from "@workstream/domain";
import type { CatalogPlacement, CatalogSymbol, IrrigationZone } from "@workstream/contracts";
import {
  metresPerCanvasPixel,
  placementIndicativeMetres,
  resolveStaticMapView,
  type StaticMapView,
} from "../lib/mapView";
import { saveDesignCanvasAction } from "../app/actions";
import { useToast } from "./ToastHost";
import { PipelineImageShell } from "./PipelineImageShell";
import sh from "./pipelineImageShell.module.css";
import {
  DesignAssetPalette,
  DesignCanvasPlacement,
  IrrigationOverlay,
  KeyboardLegend,
  MassPlantOverlay,
  MeasureOverlay,
  ScaleBar,
  StudioIrrigationPanel,
  StudioMassPlantPanel,
  StudioSchedulePanel,
  GhostPlacementOverlay,
  StudioAiPanel,
  StudioRibbon,
  StudioTier1Banner,
  StudioViewportHud,
  StudioChromeProvider,
  StudioDesktopShell,
  StudioWorkflowBadge,
  StudioMinimap,
  StudioZoomHUD,
  StudioCommandPalette,
  StudioContextStrip,
  StudioInspector,
  StudioLayersPanel,
  SiteLayersPanel,
  SiteOverlayLayer,
  SunShadeControls,
  useStudioHistory,
  useStudioPolylineDraw,
  useStudioViewport,
} from "./studio";
import type { RibbonTab } from "./studio/StudioRibbon";
import type { SiteLayerId, SiteLayerState } from "./studio/SiteLayersPanel";
import { useStudioKeyboard } from "../hooks/useStudioKeyboard";
import type { CanvasStrokeClient } from "./studio/types";
import type { RateCardItem } from "../lib/api";
import type {
  RailTab,
  RightRailTab,
  StudioShellLayout,
  ToolOverride,
} from "./studio/studioTypes";
import s from "./designStudio.module.css";

export type { CanvasStrokeClient } from "./studio/types";

type DragState =
  | {
      kind: "move";
      id: string;
      startXpct: number;
      startYpct: number;
      startClientX: number;
      startClientY: number;
    }
  | {
      kind: "rotate";
      id: string;
      centerXpct: number;
      centerYpct: number;
      startAngle: number;
      startRot: number;
    }
  | {
      kind: "scale";
      id: string;
      centerXpct: number;
      centerYpct: number;
      startDist: number;
      startScale: number;
    };

const TPZ_SYMBOL_ID = "tree-root-protection";
/** Survey markup ink — stored in payload; rendered via `.markupStroke`. */
const STROKE_INK_COLOR = "#ff2ef6";

function newId(): string {
  return crypto.randomUUID();
}

function pointerAngleDeg(
  center: { cx: number; cy: number },
  clientX: number,
  clientY: number,
): number {
  return (Math.atan2(clientY - center.cy, clientX - center.cx) * 180) / Math.PI;
}

function pointerDist(
  center: { cx: number; cy: number },
  clientX: number,
  clientY: number,
): number {
  return Math.hypot(clientX - center.cx, clientY - center.cy);
}

/** Legacy pink strokes render as survey ink (visual only; payload unchanged). */
function markupStrokeClass(color: string): string | undefined {
  if (color === STROKE_INK_COLOR) return s.markupStroke;
  return undefined;
}

type Props = {
  projectId: string;
  aerialUri: string;
  lotRing?: [number, number][];
  symbols: CatalogSymbol[];
  initialPlacements: CatalogPlacement[];
  initialStrokes: CanvasStrokeClient[];
  initialIrrigationZones?: IrrigationZone[];
  rateCard?: RateCardItem[];
  tier1?: boolean;
  hasDesign?: boolean;
  projectAddress?: string;
  shellLayout?: StudioShellLayout;
  surveyMetrics?: {
    garden_area_m2: number;
    lot_area_m2: number;
    house_area_m2: number;
    lat?: number | null;
    lng?: number | null;
  };
};

export function DesignStudio({
  projectId,
  aerialUri,
  lotRing = [],
  symbols,
  initialPlacements,
  initialStrokes,
  initialIrrigationZones = [],
  rateCard = [],
  tier1 = false,
  hasDesign = false,
  projectAddress = "Project",
  shellLayout = "legacy",
  surveyMetrics,
}: Props) {
  const tier1Active = tier1 || isTier1WrightsTerrace(projectAddress);
  const router = useRouter();
  const toast = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewport = useStudioViewport(canvasRef);
  const dragRef = useRef<DragState | null>(null);
  const pendingPlaceRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const drawingRef = useRef(false);
  const savingRef = useRef(false);

  const [toolOverride, setToolOverride] = useState<ToolOverride>(null);
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>("ai");
  const [railTab, setRailTab] = useState<RailTab>("ai");
  const [ghosts, setGhosts] = useState<GhostPlacementSuggestion[]>([]);
  const [aiScanning, setAiScanning] = useState(false);
  const [cursorPct, setCursorPct] = useState<{ x: number; y: number } | null>(null);
  const [railExpanded, setRailExpanded] = useState(false);
  const [rightRailOpen, setRightRailOpen] = useState(true);
  const [rightRailTab, setRightRailTab] = useState<RightRailTab>("library");
  const [commandOpen, setCommandOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<string | null>(null);
  const [hiddenPlacementIds, setHiddenPlacementIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [lockedPlacementIds, setLockedPlacementIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [siteLayers, setSiteLayers] = useState<SiteLayerState>({
    trp: { on: true, opacity: 38 },
    "sun-shade": { on: false, opacity: 38 },
    easements: { on: false, opacity: 38 },
    utilities: { on: false, opacity: 38 },
    permits: { on: true, opacity: 100 },
  });
  const [sunTimeHour, setSunTimeHour] = useState(14);
  const [solstice, setSolstice] = useState<"summer" | "equinox" | "winter">(
    "equinox",
  );
  const studio = useStudioHistory({
    placements: initialPlacements,
    strokes: initialStrokes,
    irrigationZones: initialIrrigationZones,
  });
  const { placements, strokes, irrigationZones, setPlacements, setStrokes, setIrrigationZones } =
    studio;
  const [draftPoints, setDraftPoints] = useState<StrokePointPct[]>([]);
  const [armedSymbolId, setArmedSymbolId] = useState<string | null>(null);
  const [paletteSelectedId, setPaletteSelectedId] = useState<string | null>(null);
  const [dragSymbolId, setDragSymbolId] = useState<string | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [lastSavedLabel, setLastSavedLabel] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const skipDirtyRef = useRef(true);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 280 });
  const [aerialError, setAerialError] = useState(false);
  const [aerialKey, setAerialKey] = useState(0);
  const [cursorHint, setCursorHint] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [measurePoints, setMeasurePoints] = useState<StrokePointPct[]>([]);
  const [massSpacingCm, setMassSpacingCm] = useState(45);
  const [massPolygonPoints, setMassPolygonPoints] = useState<StrokePointPct[]>([]);
  const [massPolygonClosed, setMassPolygonClosed] = useState(false);
  const [selectedIrrigationZoneId, setSelectedIrrigationZoneId] = useState<string | null>(
    null,
  );
  const massPlantDraw = useStudioPolylineDraw("closed");
  const irrigationDraw = useStudioPolylineDraw("open");

  const mapView: StaticMapView = useMemo(
    () => resolveStaticMapView(aerialUri, lotRing),
    [aerialUri, lotRing],
  );

  const groundScale = useMemo(
    () => {
      const mpp = metresPerCanvasPixel(
        mapView,
        canvasSize.width,
        canvasSize.height,
      );
      return {
        metresPerXPx: mpp.x,
        metresPerYPx: mpp.y,
        canvasWidthPx: canvasSize.width,
        canvasHeightPx: canvasSize.height,
      };
    },
    [mapView, canvasSize.width, canvasSize.height],
  );

  const symbolById = useMemo(
    () => new Map(symbols.map((sym) => [sym.id, sym])),
    [symbols],
  );

  const hasPlanningSymbol = placements.some((p) =>
    CATALOG_PLANNING_SYMBOL_IDS.has(p.symbol_id),
  );

  const isDrawMode = toolOverride === "draw";
  const isMeasureMode = toolOverride === "measure";
  const isMassPlantMode = toolOverride === "massplant";
  const isIrrigationMode = toolOverride === "irrigation";
  const canUndo = studio.canUndo || draftPoints.length > 0;

  useEffect(() => {
    if (skipDirtyRef.current) {
      skipDirtyRef.current = false;
      return;
    }
    setIsDirty(true);
  }, [placements, strokes, irrigationZones]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setCanvasSize({ width: Math.round(width), height: Math.round(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const setStudioTool = useCallback(
    (tool: ToolOverride) => {
      if (tool !== "irrigation" && irrigationDraw.isDrawing) {
        irrigationDraw.cancel();
      }
      if (tool !== "massplant" && massPlantDraw.isDrawing) {
        massPlantDraw.cancel();
        setMassPolygonClosed(false);
      }
      if (tool !== "measure") {
        setMeasurePoints([]);
      }
      setToolOverride(tool);
      if (shellLayout === "desktop") {
        setRightRailOpen(true);
        if (tool === "place") setRightRailTab("library");
        if (tool === "select") setRightRailTab("inspector");
      }
    },
    [irrigationDraw, massPlantDraw, shellLayout],
  );

  const handleRailTab = useCallback(
    (tab: RailTab) => {
      setRailTab(tab);
      if (tab === "massplant") setStudioTool("massplant");
      else if (tab === "irrigation") setStudioTool("irrigation");
      else if (tab === "schedule") {
        /* keep current canvas tool */
      }
    },
    [setStudioTool],
  );

  const showAssetLibrary = toolOverride === "place";

  const aiSuggestions = useMemo(
    () =>
      withDirtySaveSuggestion(
        buildStudioAiSuggestions({
          placementCount: placements.length,
          strokeCount: strokes.length,
          zoneCount: irrigationZones.length,
          hasPlanningSymbol,
          tier1: tier1Active,
          hasDesign,
        }),
        isDirty,
      ),
    [
      placements.length,
      strokes.length,
      irrigationZones.length,
      hasPlanningSymbol,
      tier1Active,
      hasDesign,
      isDirty,
    ],
  );

  const handleAiScan = useCallback(() => {
    setAiScanning(true);
    window.setTimeout(() => {
      const next = buildGhostPlacementSuggestions({
        tier1: tier1Active,
        symbolIds: symbols.map((sym) => sym.id),
      });
      setGhosts(next);
      setAiScanning(false);
      setRailTab("ai");
      toast.show(
        next.length > 0
          ? `${next.length} AI ghost hint(s) on canvas — apply or clear.`
          : "No ghosts suggested for this library.",
        next.length > 0 ? "success" : "info",
      );
    }, 480);
  }, [symbols, tier1Active, toast]);

  const applyAllGhosts = useCallback(() => {
    if (ghosts.length === 0) return;
    setPlacements((prev) => [
      ...prev,
      ...ghosts.map((g) => ({
        id: newId(),
        symbol_id: g.symbol_id,
        x_pct: g.x_pct,
        y_pct: g.y_pct,
        rotation_deg: 0,
        scale: 1,
      })),
    ]);
    setGhosts([]);
    toast.show("Applied AI ghosts to plan.", "success");
  }, [ghosts, setPlacements, toast]);

  const updatePlacement = useCallback(
    (id: string, patch: Partial<CatalogPlacement>) => {
      setPlacements((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
    },
    [setPlacements],
  );

  const deletePlacement = useCallback(
    (id: string) => {
      setPlacements((prev) => prev.filter((p) => p.id !== id));
      setSelectedPlacementId((cur) => (cur === id ? null : cur));
    },
    [setPlacements],
  );

  const addPlacement = useCallback(
    (symbolId: string, xPct: number, yPct: number) => {
      setPlacements((prev) => [
        ...prev,
        {
          id: newId(),
          symbol_id: symbolId,
          x_pct: xPct,
          y_pct: yPct,
          rotation_deg: 0,
          scale: 1,
        },
      ]);
    },
    [setPlacements],
  );

  const placeOnCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const el = canvasRef.current;
      if (!el) return;
      const symbolId = dragSymbolId ?? armedSymbolId;
      if (!symbolId) return;
      if (toolOverride === "select") return;
      if (isMeasureMode || isMassPlantMode || isIrrigationMode) return;
      const pt = viewport.clientToPct(clientX, clientY);
      addPlacement(symbolId, pt.x_pct, pt.y_pct);
      setDragSymbolId(null);
    },
    [
      addPlacement,
      armedSymbolId,
      dragSymbolId,
      isIrrigationMode,
      isMassPlantMode,
      isMeasureMode,
      toolOverride,
      viewport,
    ],
  );

  const commitDraftStroke = useCallback(() => {
    if (draftPoints.length < 2) {
      setDraftPoints([]);
      return;
    }
    setStrokes((prev) => [
      ...prev,
      {
        id: newId(),
        points: draftPoints,
        color: STROKE_INK_COLOR,
        width_px: 2,
      },
    ]);
    setDraftPoints([]);
  }, [draftPoints, setStrokes]);

  const undo = useCallback(() => {
    if (draftPoints.length > 0) {
      setDraftPoints([]);
      return;
    }
    studio.undo();
  }, [draftPoints.length, studio]);

  const redo = useCallback(() => {
    studio.redo();
  }, [studio]);

  const clearStrokes = useCallback(() => {
    if (strokes.length === 0) return;
    const snapshot = [...strokes];
    setStrokes([], true);
    toast.show(`Cleared ${snapshot.length} markup stroke(s).`, "info", 6000, {
      action: { label: "Undo", onClick: () => setStrokes(snapshot, false) },
    });
  }, [strokes, setStrokes, toast]);

  const clearPlacements = useCallback(() => {
    if (placements.length === 0) return;
    if (!window.confirm("Clear all symbols from the plan?")) return;
    const snapshot = [...placements];
    setPlacements([], true);
    setSelectedPlacementId(null);
    toast.show(`Cleared ${snapshot.length} symbol(s).`, "info", 6000, {
      action: {
        label: "Undo",
        onClick: () => setPlacements(snapshot, false),
      },
    });
  }, [placements, setPlacements, toast]);

  const handlePaletteSelect = useCallback(
    (id: string) => {
      setPaletteSelectedId(id);
      if (toolOverride !== "select") {
        setArmedSymbolId(id);
      }
    },
    [setArmedSymbolId, toolOverride],
  );

  const updateCursorHint = useCallback(
    (clientX: number, clientY: number) => {
      if (dragRef.current) return;
      const el = canvasRef.current;
      if (!el || isDrawMode || isMeasureMode || isMassPlantMode || isIrrigationMode) {
        setCursorHint(null);
        return;
      }
      const pt = viewport.clientToPct(clientX, clientY);
      setCursorPct({ x: pt.x_pct, y: pt.y_pct });
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        setCursorHint(null);
        return;
      }
      const armed = symbolById.get(armedSymbolId ?? "");
      const selected = placements.find((p) => p.id === selectedPlacementId);
      const selectedSym = selected
        ? symbolById.get(selected.symbol_id)
        : undefined;
      let text = "Click a symbol to select";
      if (armed) text = `Place ${armed.label}`;
      else if (selectedSym) text = `Move ${selectedSym.label}`;
      setCursorHint({ x, y, text });
    },
    [
      armedSymbolId,
      isDrawMode,
      isIrrigationMode,
      isMassPlantMode,
      isMeasureMode,
      placements,
      selectedPlacementId,
      symbolById,
      viewport,
    ],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        if (irrigationDraw.isDrawing) {
          irrigationDraw.cancel();
          return;
        }
        if (massPlantDraw.isDrawing) {
          massPlantDraw.cancel();
          setMassPolygonClosed(false);
          setMassPolygonPoints([]);
          return;
        }
        if (isMeasureMode) {
          setMeasurePoints([]);
          setStudioTool(null);
          return;
        }
        setSelectedPlacementId(null);
        setArmedSymbolId(null);
        setDragSymbolId(null);
        setDraftPoints([]);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedPlacementId) {
          e.preventDefault();
          deletePlacement(selectedPlacementId);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key.toLowerCase() === "m") {
        setStudioTool("measure");
        return;
      }
      if (e.key.toLowerCase() === "p") {
        setStudioTool("place");
        return;
      }
      if (e.key.toLowerCase() === "d") {
        setStudioTool("draw");
        setSelectedPlacementId(null);
        return;
      }
      if (e.key.toLowerCase() === "v") {
        setStudioTool("select");
        setArmedSymbolId(null);
        return;
      }
      if (e.key.toLowerCase() === "h") {
        setStudioTool("pan");
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    deletePlacement,
    irrigationDraw,
    isMeasureMode,
    massPlantDraw,
    redo,
    selectedPlacementId,
    setArmedSymbolId,
    setStudioTool,
    undo,
  ]);

  function handlePolylineTap(clientX: number, clientY: number) {
    const pt = viewport.clientToPct(clientX, clientY);

    if (isMeasureMode) {
      setMeasurePoints((prev) => (prev.length >= 2 ? [pt] : [...prev, pt]));
      return;
    }
    if (isMassPlantMode && massPlantDraw.isDrawing) {
      massPlantDraw.addPoint(pt);
      return;
    }
    if (isIrrigationMode && irrigationDraw.isDrawing) {
      irrigationDraw.addPoint(pt);
    }
  }

  function handleCanvasPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (toolOverride === "pan" || viewport.spacePan) {
      viewport.beginPan(e.clientX, e.clientY);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (toolOverride === "select") {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-placement-id]")) {
        viewport.beginPan(e.clientX, e.clientY);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    if (isMeasureMode || (isMassPlantMode && massPlantDraw.isDrawing) || (isIrrigationMode && irrigationDraw.isDrawing)) {
      handlePolylineTap(e.clientX, e.clientY);
      return;
    }

    if (isDrawMode) {
      const el = canvasRef.current;
      if (!el) return;
      drawingRef.current = true;
      el.setPointerCapture(e.pointerId);
      setDraftPoints([viewport.clientToPct(e.clientX, e.clientY)]);
      setSelectedPlacementId(null);
      return;
    }

    const target = e.target as HTMLElement;
    if (target.closest("[data-placement-id]")) return;

    setSelectedPlacementId(null);
    pendingPlaceRef.current = { clientX: e.clientX, clientY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleCanvasPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const pct = viewport.clientToPct(e.clientX, e.clientY);
    setCursorPct({ x: pct.x_pct, y: pct.y_pct });

    if (viewport.isPanning) {
      viewport.movePan(e.clientX, e.clientY);
      return;
    }

    if (drawingRef.current && isDrawMode) {
      const pt = viewport.clientToPct(e.clientX, e.clientY);
      setDraftPoints((prev) => {
        const last = prev[prev.length - 1];
        if (last && Math.hypot(last.x_pct - pt.x_pct, last.y_pct - pt.y_pct) < 0.4) {
          return prev;
        }
        return [...prev, pt];
      });
      return;
    }

    const drag = dragRef.current;
    if (drag) {
      if (drag.kind === "move") {
        const { dx, dy } = viewport.pctDeltaFromScreen(
          e.clientX - drag.startClientX,
          e.clientY - drag.startClientY,
        );
        updatePlacement(drag.id, {
          x_pct: Math.min(100, Math.max(0, drag.startXpct + dx)),
          y_pct: Math.min(100, Math.max(0, drag.startYpct + dy)),
        });
      } else if (drag.kind === "rotate") {
        const center = viewport.placementCenterClient(
          drag.centerXpct,
          drag.centerYpct,
        );
        if (center) {
          const angle = pointerAngleDeg(center, e.clientX, e.clientY);
          updatePlacement(drag.id, {
            rotation_deg: (drag.startRot + angle - drag.startAngle + 360) % 360,
          });
        }
      } else if (drag.kind === "scale") {
        const center = viewport.placementCenterClient(
          drag.centerXpct,
          drag.centerYpct,
        );
        if (center) {
          const dist = pointerDist(center, e.clientX, e.clientY);
          const next = Math.min(
            4,
            Math.max(0.35, drag.startScale * (dist / drag.startDist)),
          );
          updatePlacement(drag.id, { scale: next });
        }
      }
      return;
    }

    updateCursorHint(e.clientX, e.clientY);
  }

  function releaseCanvasCapture(e: React.PointerEvent<HTMLDivElement>) {
    const el = canvasRef.current;
    if (el?.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
  }

  function handleCanvasPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    if (viewport.isPanning) {
      viewport.endPan();
      releaseCanvasCapture(e);
      return;
    }
    if (drawingRef.current) {
      drawingRef.current = false;
      setDraftPoints([]);
      releaseCanvasCapture(e);
      return;
    }
    dragRef.current = null;
    pendingPlaceRef.current = null;
    releaseCanvasCapture(e);
  }

  function handleCanvasPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (viewport.isPanning) {
      viewport.endPan();
      releaseCanvasCapture(e);
      return;
    }
    if (drawingRef.current) {
      drawingRef.current = false;
      releaseCanvasCapture(e);
      commitDraftStroke();
      return;
    }

    const hadDrag = dragRef.current !== null;
    dragRef.current = null;

    const pending = pendingPlaceRef.current;
    pendingPlaceRef.current = null;
    if (pending && !hadDrag) {
      const moved = Math.hypot(
        e.clientX - pending.clientX,
        e.clientY - pending.clientY,
      );
      if (moved < 6) {
        placeOnCanvas(pending.clientX, pending.clientY);
      }
    }

    releaseCanvasCapture(e);
  }

  function beginPlacementDrag(id: string, e: React.PointerEvent) {
    pendingPlaceRef.current = null;
    startMoveDrag(id, e);
  }

  function startMoveDrag(id: string, e: React.PointerEvent) {
    const el = canvasRef.current;
    const placement = placements.find((p) => p.id === id);
    if (!el || !placement) return;
    dragRef.current = {
      kind: "move",
      id,
      startXpct: placement.x_pct,
      startYpct: placement.y_pct,
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
    el.setPointerCapture(e.pointerId);
  }

  function startRotateDrag(id: string, e: React.PointerEvent) {
    pendingPlaceRef.current = null;
    const el = canvasRef.current;
    const placement = placements.find((p) => p.id === id);
    if (!el || !placement) return;
    const center = viewport.placementCenterClient(placement.x_pct, placement.y_pct);
    dragRef.current = {
      kind: "rotate",
      id,
      centerXpct: placement.x_pct,
      centerYpct: placement.y_pct,
      startAngle: center
        ? pointerAngleDeg(center, e.clientX, e.clientY)
        : 0,
      startRot: placement.rotation_deg,
    };
    el.setPointerCapture(e.pointerId);
  }

  function startScaleDrag(id: string, e: React.PointerEvent) {
    pendingPlaceRef.current = null;
    const el = canvasRef.current;
    const placement = placements.find((p) => p.id === id);
    if (!el || !placement) return;
    const center = viewport.placementCenterClient(placement.x_pct, placement.y_pct);
    dragRef.current = {
      kind: "scale",
      id,
      centerXpct: placement.x_pct,
      centerYpct: placement.y_pct,
      startDist: center ? pointerDist(center, e.clientX, e.clientY) : 1,
      startScale: placement.scale,
    };
    el.setPointerCapture(e.pointerId);
  }

  async function handleSave() {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      await saveDesignCanvasAction(projectId, placements, strokes, irrigationZones);
      setLastSavedLabel(
        new Date().toLocaleTimeString("en-AU", {
          hour: "numeric",
          minute: "2-digit",
        }),
      );
      setIsDirty(false);
      toast.show(
        "Saved — concept ready for envelope estimate. Send to draftsperson for working drawings.",
        "success",
      );
      router.refresh();
      return true;
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Save failed", "error");
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleSaveAndOpenOutputs() {
    const ok = await handleSave();
    if (ok) router.push(`/projects/${projectId}/outputs`);
  }

  function handleAiSuggestion(suggestion: StudioAiSuggestion) {
    switch (suggestion.action) {
      case "save":
        void handleSave();
        break;
      case "develop":
        void (async () => {
          const ok = await handleSave();
          if (ok) router.push(`/projects/${projectId}/design/develop`);
        })();
        break;
      case "schedule":
        setRailTab("schedule");
        break;
      case "trp":
      case "place":
        if (suggestion.symbol_id) {
          setArmedSymbolId(suggestion.symbol_id);
          setStudioTool("place");
        } else {
          setStudioTool("place");
        }
        break;
      default:
        break;
    }
  }

  const toolHint = (() => {
    if (isMeasureMode) {
      return measurePoints.length < 2
        ? "Tap two points on the aerial to measure (indicative)."
        : "Tap again to start a new measurement.";
    }
    if (isMassPlantMode && massPlantDraw.isDrawing) {
      return `Placing bed points (${massPlantDraw.points.length}). Tap Finish bed when done.`;
    }
    if (isIrrigationMode && irrigationDraw.isDrawing) {
      return `Tracing drip line (${irrigationDraw.points.length} points). Tap Finish line when done.`;
    }
    if (isDrawMode) return null;
    if (toolOverride === "select") return null;
    return null;
  })();

  const draftPath =
    draftPoints.length >= 2
      ? strokePointsToPathD(
          draftPoints,
          canvasSize.width,
          canvasSize.height,
          2,
        )
      : "";

  const canvasEmpty =
    placements.length === 0 &&
    strokes.length === 0 &&
    irrigationZones.length === 0;

  const isPlotMode = isMeasureMode || isMassPlantMode || isIrrigationMode;
  const isPanActive = toolOverride === "pan" || viewport.spacePan;
  const canvasClass = isPanActive
    ? s.canvasPan
    : isDrawMode
      ? s.canvasDraw
      : isPlotMode
        ? s.canvasPlot
        : s.canvasPlace;

  const activeToolLabel = (() => {
    if (toolOverride === "pan" || viewport.spacePan) return "Pan";
    if (toolOverride === "draw") return "Draw";
    if (toolOverride === "select") return "Select";
    if (toolOverride === "measure") return "Measure";
    if (toolOverride === "massplant") return "Mass plant";
    if (toolOverride === "irrigation") return "Irrigation";
    if (toolOverride === "place") return "Place";
    return "Auto";
  })();

  const armedSymbolLabel = armedSymbolId
    ? (symbolById.get(armedSymbolId)?.label ?? null)
    : null;

  const statusMessage = (() => {
    if (toolHint) return toolHint;
    if (isDrawMode) {
      return "Markup with mouse, trackpad, or stylus — survey ink (concept sketch only).";
    }
    if (isMeasureMode) {
      return "Tap two points on the aerial for an indicative distance.";
    }
    if (isMassPlantMode) {
      return "Outline a planting bed, set spacing, then fill with a staggered grid.";
    }
    if (isIrrigationMode) {
      return "Trace drip lines by zone — spacing and flow update the schedule live.";
    }
    if (toolOverride === "select") {
      return "Select symbols to move, rotate, or scale. Delete removes the selection.";
    }
    return "Pick an asset, then click the aerial to place — or drag from the library.";
  })();

  const saveStatusDotClass = saving
    ? s.saveStatusDotSaving
    : isDirty
      ? s.saveStatusDotDirty
      : lastSavedLabel
        ? s.saveStatusDotSaved
        : s.saveStatusDotReady;

  const saveStatusText = saving
    ? "Saving…"
    : isDirty
      ? "Unsaved changes"
      : lastSavedLabel
        ? `Saved ${lastSavedLabel}`
        : "Ready to save";

  const scheduleBadge =
    placements.length + irrigationZones.length > 0
      ? placements.length + irrigationZones.length
      : null;

  const railTabs = [
    ["ai", "AI assist", ghosts.length || (tier1Active ? "T1" : null)],
    ["massplant", "Mass plant", null],
    ["irrigation", "Irrigation", irrigationZones.length || null],
    ["schedule", "Schedule", scheduleBadge],
  ] as const;

  const saveStatusNode = (
    <span
      className={`${s.saveStatus} ${s.saveStatusRow}`}
      aria-live="polite"
      data-testid="design-studio-save-status"
    >
      <span className={`${s.saveStatusDot} ${saveStatusDotClass}`} aria-hidden />
      {saveStatusText}
    </span>
  );

  const countsNode = (
    <span data-testid="design-studio-counts" className={s.canvasHudPill}>
      {placements.length} symbols · {irrigationZones.length} zones
    </span>
  );

  const saveButtonNode = (
    <button
      type="button"
      className={s.btnPrimary}
      disabled={saving}
      onClick={() => void handleSave()}
      data-testid="design-studio-save"
    >
      {saving ? "Saving…" : "Save plan"}
    </button>
  );

  const railPanels = (
    <>
      {showAssetLibrary ? (
        <div className={s.railLibrary} aria-label="Asset library">
          <p className={s.railLibraryHint}>Place mode — pick a symbol, then tap the aerial.</p>
          <DesignAssetPalette
            symbols={symbols}
            selectedId={paletteSelectedId}
            disabled={isDrawMode}
            embedded
            onSelect={handlePaletteSelect}
            onDragStart={(id) => {
              setDragSymbolId(id);
              setArmedSymbolId(id);
            }}
            onDragEnd={() => setDragSymbolId(null)}
          />
        </div>
      ) : null}
      <div className={s.railTabs} role="tablist" aria-label="Studio panels">
        {railTabs.map(([id, label, badge]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={railTab === id}
            className={`${s.railTab} ${railTab === id ? s.railTabActive : ""}`}
            onClick={() => handleRailTab(id)}
          >
            {label}
            {badge ? <span className={s.railTabBadge}>{badge}</span> : null}
          </button>
        ))}
      </div>
      <div className={s.railPanel} role="tabpanel">
        {railTab === "ai" ? (
          <StudioAiPanel
            projectId={projectId}
            tier1={tier1Active}
            suggestions={aiSuggestions}
            ghosts={ghosts}
            scanning={aiScanning}
            onScanSite={handleAiScan}
            onApplyAllGhosts={applyAllGhosts}
            onClearGhosts={() => setGhosts([])}
            onSuggestionAction={handleAiSuggestion}
            symbolLabel={(id) => symbolById.get(id)?.label ?? id}
          />
        ) : null}
        {railTab === "massplant" ? (
          <StudioMassPlantPanel
            symbols={symbols}
            polygonPoints={massPlantDraw.isDrawing ? massPlantDraw.points : massPolygonPoints}
            polygonClosed={massPolygonClosed}
            isDrawing={massPlantDraw.isDrawing}
            spacingCm={massSpacingCm}
            scale={groundScale}
            onSpacingChange={setMassSpacingCm}
            onStartDraw={() => {
              setStudioTool("massplant");
              setMassPolygonClosed(false);
              setMassPolygonPoints([]);
              massPlantDraw.start();
            }}
            onFinishPolygon={() => {
              const pts = massPlantDraw.finish();
              if (pts) {
                setMassPolygonPoints(pts);
                setMassPolygonClosed(true);
              } else toast.show("Need at least 3 points for a bed.", "error");
            }}
            onClear={() => {
              massPlantDraw.cancel();
              setMassPolygonClosed(false);
              setMassPolygonPoints([]);
            }}
            onFill={(newPlacements) => {
              setPlacements((prev) => [...prev, ...newPlacements]);
              setRailTab("schedule");
              toast.show(`Placed ${newPlacements.length} plants.`, "success");
            }}
          />
        ) : null}
        {railTab === "irrigation" ? (
          <StudioIrrigationPanel
            zones={irrigationZones}
            selectedZoneId={selectedIrrigationZoneId}
            isDrawing={irrigationDraw.isDrawing}
            scale={groundScale}
            onSelectZone={setSelectedIrrigationZoneId}
            onUpdateZone={(id, patch) => {
              setIrrigationZones(
                (prev) => prev.map((z) => (z.id === id ? { ...z, ...patch } : z)),
                false,
              );
            }}
            onDeleteZone={(id) => {
              if (!window.confirm("Delete this irrigation zone?")) return;
              setIrrigationZones((prev) => prev.filter((z) => z.id !== id));
              setSelectedIrrigationZoneId((cur) => (cur === id ? null : cur));
            }}
            onStartNewZone={() => {
              setStudioTool("irrigation");
              setSelectedIrrigationZoneId(null);
              irrigationDraw.start();
            }}
            onFinishLine={() => {
              const pts = irrigationDraw.finish();
              if (!pts) {
                toast.show("Need at least 2 points for a line.", "error");
                return;
              }
              const zone = {
                id: newId(),
                name: `Zone ${irrigationZones.length + 1}`,
                points: pts,
                emitter_spacing_cm: 30,
                emitter_flow_lph: 2,
              };
              setIrrigationZones((prev) => [...prev, zone]);
              setSelectedIrrigationZoneId(zone.id);
              setRailTab("schedule");
              toast.show(`Zone "${zone.name}" created.`, "success");
            }}
          />
        ) : null}
        {railTab === "schedule" ? (
          <StudioSchedulePanel
            placements={placements}
            irrigationZones={irrigationZones}
            symbols={symbols}
            rateCard={rateCard}
            scale={groundScale}
            onCopySchedule={(md) => {
              void navigator.clipboard.writeText(md);
              toast.show("Schedule copied to clipboard.", "success");
            }}
            onOpenOutputs={() => void handleSaveAndOpenOutputs()}
            saving={saving}
          />
        ) : null}
      </div>
    </>
  );

  const canvasWorkspace = (
    <>
      {hasPlanningSymbol ? (
        <p className={s.tpzAdvisory} role="status">
          Tree protection symbols present — confirm against arborist report and council
          requirements before build.
        </p>
      ) : null}
      <div
        className={`${s.statusBar} ${toolHint ? s.statusBarActive : ""}`}
        role="status"
        aria-live="polite"
      >
        <span className={s.statusBarLabel}>{activeToolLabel}</span>
        <p className={s.statusBarText}>{statusMessage}</p>
      </div>
      <div
        ref={canvasRef}
        className={`${sh.canvas} ${canvasClass}`}
        onWheel={viewport.onWheel}
        onDragOver={(e) => {
          if (isDrawMode || toolOverride === "select") return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          if (isDrawMode || toolOverride === "select") return;
          e.preventDefault();
          placeOnCanvas(e.clientX, e.clientY);
        }}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerLeave={(e) => {
          if (drawingRef.current || dragRef.current) {
            handleCanvasPointerCancel(e);
          } else {
            handleCanvasPointerUp(e);
          }
          setCursorHint(null);
        }}
        onPointerCancel={handleCanvasPointerCancel}
        onContextMenu={(e) => isDrawMode && e.preventDefault()}
        role="application"
        aria-label="Site plan canvas"
        data-testid="design-studio-canvas"
      >
        {shellLayout === "desktop" ? (
          <>
            <StudioMinimap aerialSrc={aerialUri} />
            <StudioZoomHUD />
          </>
        ) : null}
        <div className={s.canvasHud} aria-hidden>
          <span className={s.canvasHudPill}>{activeToolLabel}</span>
          {shellLayout === "legacy" ? countsNode : null}
          {armedSymbolLabel ? (
            <span className={s.canvasHudArmed}>{armedSymbolLabel}</span>
          ) : null}
        </div>
        <div className={sh.stage} style={viewport.stageStyle}>
        {aerialError ? (
          <div className={s.aerialError}>
            <p>Aerial image failed to load.</p>
            <button
              type="button"
              className={s.toolBtn}
              onClick={() => {
                setAerialError(false);
                setAerialKey((k) => k + 1);
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={aerialKey}
            src={aerialUri}
            alt=""
            className={sh.aerial}
            draggable={false}
            onError={() => setAerialError(true)}
          />
        )}
        <svg
          className={s.strokeLayer}
          viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          {strokes.map((stroke) => (
            <path
              key={stroke.id}
              className={markupStrokeClass(stroke.color)}
              d={canvasStrokeToPathD(stroke, canvasSize.width, canvasSize.height)}
              fill={markupStrokeClass(stroke.color) ? undefined : stroke.color}
            />
          ))}
          {draftPath ? <path d={draftPath} className={s.markupStroke} /> : null}
        </svg>
        <IrrigationOverlay
          zones={irrigationZones}
          draftPoints={irrigationDraw.points}
          canvasWidthPx={canvasSize.width}
          canvasHeightPx={canvasSize.height}
        />
        <MassPlantOverlay
          points={massPlantDraw.isDrawing ? massPlantDraw.points : massPolygonPoints}
          closed={massPolygonClosed && !massPlantDraw.isDrawing}
          draft={massPlantDraw.isDrawing}
          canvasWidthPx={canvasSize.width}
          canvasHeightPx={canvasSize.height}
        />
        <MeasureOverlay
          points={measurePoints}
          canvasWidthPx={canvasSize.width}
          canvasHeightPx={canvasSize.height}
          scale={groundScale}
        />
        <GhostPlacementOverlay ghosts={ghosts} symbolById={symbolById} />
        {surveyMetrics && shellLayout === "desktop" ? (
          <SiteOverlayLayer
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            placements={placements}
            symbols={symbols}
            layers={siteLayers}
            lat={surveyMetrics.lat ?? -37.81}
            lng={surveyMetrics.lng ?? 144.96}
            shadeWhen={new Date()}
            siteWidthM={Math.sqrt(surveyMetrics.garden_area_m2) || 20}
            hiddenIds={hiddenPlacementIds}
          />
        ) : null}
        {placements.map((p) => {
          if (hiddenPlacementIds.has(p.id)) return null;
          const sym = symbolById.get(p.symbol_id);
          if (!sym) return null;
          const isTpz = p.symbol_id === TPZ_SYMBOL_ID;
          const baseM = sym.default_width_m ?? 8;
          return (
            <DesignCanvasPlacement
              key={p.id}
              placement={p}
              symbol={sym}
              selected={selectedPlacementId === p.id}
              isTpz={isTpz}
              indicativeMetres={
                isTpz ? placementIndicativeMetres(baseM, p.scale) : null
              }
              onSelect={() => setSelectedPlacementId(p.id)}
              onMovePointerDown={(e) => beginPlacementDrag(p.id, e)}
              onRotateStart={(e) => startRotateDrag(p.id, e)}
              onScaleStart={(e) => startScaleDrag(p.id, e)}
              onDelete={() => deletePlacement(p.id)}
            />
          );
        })}
        {canvasEmpty && !isDrawMode && !isPlotMode ? (
          <div className={s.emptyPrompt}>
            <div className={s.emptyPromptCard}>
              <p className={s.emptyPromptTitle}>Start your concept sketch</p>
              <ol className={s.emptyPromptSteps}>
                <li>Choose an asset from the library</li>
                <li>Click the aerial to place symbols</li>
                <li>Draw beds, irrigation, or markup as needed</li>
                <li>Open Schedule for a live estimate</li>
              </ol>
            </div>
          </div>
        ) : null}
        {cursorHint && !isDrawMode && !isPlotMode ? (
          <div
            className={s.contextLabel}
            style={{ left: cursorHint.x, top: cursorHint.y }}
            aria-hidden
          >
            {cursorHint.text}
          </div>
        ) : null}
        <ScaleBar mapView={mapView} canvasWidthPx={canvasSize.width} />
        <p className={sh.honestyCaption}>
          Concept sketch for estimating — not a construction drawing.
        </p>
        </div>
      </div>
    </>
  );

  const selectedPlacement =
    placements.find((p) => p.id === selectedPlacementId) ?? null;
  const selectedSymbol = selectedPlacement
    ? symbolById.get(selectedPlacement.symbol_id) ?? null
    : null;

  useEffect(() => {
    if (selectedPlacementId && shellLayout === "desktop") {
      setRightRailTab("inspector");
      setRightRailOpen(true);
    }
  }, [selectedPlacementId, shellLayout]);

  useStudioKeyboard(
    {
      setTool: setStudioTool,
      onUndo: undo,
      onRedo: redo,
      canUndo,
      canRedo: studio.canRedo,
      onDelete: () => {
        if (selectedPlacementId) deletePlacement(selectedPlacementId);
      },
      onZoomIn: viewport.zoomIn,
      onZoomOut: viewport.zoomOut,
      onResetView: viewport.resetView,
      onToggleRightRail: () => setRightRailOpen((o) => !o),
      onOpenCommandPalette: () => setCommandOpen(true),
      onToggleFocusMode: () => setFocusMode((f) => !f),
      onSelectAll: () => {
        if (placements.length > 0) {
          setSelectedPlacementId(placements[0].id);
        }
      },
    },
    shellLayout === "desktop",
  );

  const desktopRightRail = (
    <>
      {toolOverride === "massplant" ? (
        <StudioMassPlantPanel
          symbols={symbols}
          polygonPoints={massPlantDraw.isDrawing ? massPlantDraw.points : massPolygonPoints}
          polygonClosed={massPolygonClosed}
          isDrawing={massPlantDraw.isDrawing}
          spacingCm={massSpacingCm}
          scale={groundScale}
          onSpacingChange={setMassSpacingCm}
          onStartDraw={() => {
            setStudioTool("massplant");
            setMassPolygonClosed(false);
            setMassPolygonPoints([]);
            massPlantDraw.start();
          }}
          onFinishPolygon={() => {
            const pts = massPlantDraw.finish();
            if (pts) {
              setMassPolygonPoints(pts);
              setMassPolygonClosed(true);
            } else toast.show("Need at least 3 points for a bed.", "error");
          }}
          onClear={() => {
            massPlantDraw.cancel();
            setMassPolygonClosed(false);
            setMassPolygonPoints([]);
          }}
          onFill={(newPlacements) => {
            setPlacements((prev) => [...prev, ...newPlacements]);
            setRightRailTab("schedule");
            toast.show(`Placed ${newPlacements.length} plants.`, "success");
          }}
        />
      ) : null}
      {toolOverride === "irrigation" ? (
        <StudioIrrigationPanel
          zones={irrigationZones}
          selectedZoneId={selectedIrrigationZoneId}
          isDrawing={irrigationDraw.isDrawing}
          scale={groundScale}
          onSelectZone={setSelectedIrrigationZoneId}
          onUpdateZone={(id, patch) => {
            setIrrigationZones(
              (prev) => prev.map((z) => (z.id === id ? { ...z, ...patch } : z)),
              false,
            );
          }}
          onDeleteZone={(id) => {
            if (!window.confirm("Delete this irrigation zone?")) return;
            setIrrigationZones((prev) => prev.filter((z) => z.id !== id));
            setSelectedIrrigationZoneId((cur) => (cur === id ? null : cur));
          }}
          onStartNewZone={() => {
            setStudioTool("irrigation");
            setSelectedIrrigationZoneId(null);
            irrigationDraw.start();
          }}
          onFinishLine={() => {
            const pts = irrigationDraw.finish();
            if (!pts) {
              toast.show("Need at least 2 points for a line.", "error");
              return;
            }
            const zone = {
              id: newId(),
              name: `Zone ${irrigationZones.length + 1}`,
              points: pts,
              emitter_spacing_cm: 30,
              emitter_flow_lph: 2,
            };
            setIrrigationZones((prev) => [...prev, zone]);
            setSelectedIrrigationZoneId(zone.id);
            setRightRailTab("schedule");
            toast.show(`Zone "${zone.name}" created.`, "success");
          }}
        />
      ) : null}
      {toolOverride !== "massplant" && toolOverride !== "irrigation" ? (
        <>
      {rightRailTab === "inspector" ? (
        <StudioInspector
          projectId={projectId}
          projectAddress={projectAddress}
          placement={selectedPlacement}
          symbol={selectedSymbol}
          gardenAreaM2={surveyMetrics?.garden_area_m2}
          onLabelChange={(label) => {
            if (!selectedPlacementId) return;
            updatePlacement(selectedPlacementId, { label });
          }}
          onRotationChange={(deg) => {
            if (!selectedPlacementId) return;
            updatePlacement(selectedPlacementId, {
              rotation_deg: Math.min(360, Math.max(0, deg)),
            });
          }}
        />
      ) : null}
      {rightRailTab === "layers" ? (
        <StudioLayersPanel
          rows={placements
            .map((p) => {
              const sym = symbolById.get(p.symbol_id);
              if (!sym) return null;
              return {
                placement: p,
                symbol: sym,
                hidden: hiddenPlacementIds.has(p.id),
                locked: lockedPlacementIds.has(p.id),
              };
            })
            .filter(Boolean) as {
            placement: CatalogPlacement;
            symbol: CatalogSymbol;
            hidden: boolean;
            locked: boolean;
          }[]}
          selectedId={selectedPlacementId}
          onSelect={(id) => setSelectedPlacementId(id)}
          onToggleHidden={(id) => {
            setHiddenPlacementIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
          onToggleLocked={(id) => {
            setLockedPlacementIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
          onShowAll={() => setHiddenPlacementIds(new Set())}
          onHideAll={() =>
            setHiddenPlacementIds(new Set(placements.map((p) => p.id)))
          }
        />
      ) : null}
      {rightRailTab === "library" ? (
        <DesignAssetPalette
          symbols={symbols}
          selectedId={paletteSelectedId}
          disabled={isDrawMode}
          embedded
          onSelect={(id) => {
            handlePaletteSelect(id);
            setStudioTool("place");
          }}
          onDragStart={(id) => {
            setDragSymbolId(id);
            setArmedSymbolId(id);
          }}
          onDragEnd={() => setDragSymbolId(null)}
        />
      ) : null}
      {rightRailTab === "schedule" ? (
        <StudioSchedulePanel
          placements={placements}
          irrigationZones={irrigationZones}
          symbols={symbols}
          rateCard={rateCard}
          scale={groundScale}
          onCopySchedule={(md) => {
            void navigator.clipboard.writeText(md);
            toast.show("Schedule copied to clipboard.", "success");
          }}
          onOpenOutputs={() => void handleSaveAndOpenOutputs()}
          saving={saving}
        />
      ) : null}
      {rightRailTab === "ai" ? (
        <StudioAiPanel
          projectId={projectId}
          tier1={tier1Active}
          suggestions={aiSuggestions}
          ghosts={ghosts}
          scanning={aiScanning}
          onScanSite={handleAiScan}
          onApplyAllGhosts={applyAllGhosts}
          onClearGhosts={() => setGhosts([])}
          onSuggestionAction={handleAiSuggestion}
          symbolLabel={(id) => symbolById.get(id)?.label ?? id}
        />
      ) : null}
        </>
      ) : null}
    </>
  );

  const ghostAcceptBar =
    ghosts.length > 0 ? (
      <div className={s.ghostAcceptBar} role="status">
        <span>
          {ghosts.length} suggested change{ghosts.length === 1 ? "" : "s"} — indicative
        </span>
        <button type="button" className={s.btnPrimary} onClick={applyAllGhosts}>
          Apply
        </button>
        <button
          type="button"
          className={s.toolBtn}
          onClick={() => setGhosts([])}
        >
          Discard
        </button>
      </div>
    ) : null;

  const chromeValue = useMemo(
    () => ({
      toolOverride,
      setToolOverride: setStudioTool,
      railExpanded,
      setRailExpanded,
      rightRailOpen,
      setRightRailOpen,
      saveStatusText,
      saveStatusDotClass,
      selectionCount: selectedPlacementId ? 1 : 0,
      symbolCount: placements.length,
      zoneCount: irrigationZones.length,
      cursorPct,
      setCursorPct,
      zoomPercent: viewport.zoomPercent,
      onZoomIn: viewport.zoomIn,
      onZoomOut: viewport.zoomOut,
      onResetView: viewport.resetView,
      onSave: () => void handleSave(),
      saving,
      canUndo,
      onUndo: undo,
      canRedo: studio.canRedo,
      onRedo: redo,
      onOpenCommandPalette: () => setCommandOpen(true),
      onOpenLayers: () => {
        setRightRailTab("layers");
        setRightRailOpen(true);
      },
      onOpenSitePanel: () => {
        setRibbonTab("site");
      },
      onOpenLibrary: () => {
        setRightRailTab("library");
        setRightRailOpen(true);
        setStudioTool("place");
      },
      onRibbonTab: setRibbonTab,
      onRightRailTab: (tab: RightRailTab) => {
        setRightRailTab(tab);
        setRightRailOpen(true);
      },
      siteLayers,
      onToggleSiteLayer: (id: SiteLayerId) =>
        setSiteLayers((prev) => ({
          ...prev,
          [id]: { ...prev[id], on: !prev[id].on },
        })),
    }),
    [
      toolOverride,
      setStudioTool,
      railExpanded,
      rightRailOpen,
      saveStatusText,
      saveStatusDotClass,
      selectedPlacementId,
      placements.length,
      irrigationZones.length,
      cursorPct,
      viewport.zoomPercent,
      saving,
      canUndo,
      undo,
      studio.canRedo,
      redo,
      siteLayers,
    ],
  );

  if (shellLayout === "desktop") {
    const surveyPick = surveyMetrics ?? {
      garden_area_m2: 400,
      lot_area_m2: 600,
      house_area_m2: 200,
      lat: -37.81,
      lng: 144.96,
    };

    return (
      <StudioChromeProvider value={chromeValue}>
        <StudioCommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          symbols={symbols}
          onTool={setStudioTool}
          onResetView={viewport.resetView}
          onZoomIn={viewport.zoomIn}
          onZoomOut={viewport.zoomOut}
          onToggleRightRail={() => setRightRailOpen((o) => !o)}
          onToggleFocusMode={() => setFocusMode((f) => !f)}
          onPlaceSymbol={(id) => {
            setArmedSymbolId(id);
            setPaletteSelectedId(id);
            setStudioTool("place");
          }}
          projectId={projectId}
        />
        <StudioDesktopShell
          projectId={projectId}
          projectAddress={projectAddress}
          topbarExtras={saveStatusText}
          rightRailTab={rightRailTab}
          onRightRailTab={(tab) => {
            setRightRailTab(tab);
            setRightRailOpen(true);
          }}
          focusMode={focusMode}
          ghostBar={ghostAcceptBar}
          ribbon={
            <StudioRibbon
              ribbonTab={ribbonTab}
              onRibbonTab={setRibbonTab}
              toolOverride={toolOverride}
              onTool={setStudioTool}
              zoomPercent={viewport.zoomPercent}
              onZoomIn={viewport.zoomIn}
              onZoomOut={viewport.zoomOut}
              onResetView={viewport.resetView}
              onOpenAiRail={() => {
                setRightRailTab("ai");
                setRightRailOpen(true);
              }}
              canUndo={canUndo}
              onUndo={undo}
              onRedo={redo}
              canRedo={studio.canRedo}
              tier1={tier1Active}
              saveStatus={saveStatusNode}
              saveButton={saveButtonNode}
            />
          }
          contextStrip={
            <StudioContextStrip
              ribbonTab={ribbonTab}
              projectAddress={projectAddress}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={studio.canRedo}
              onScan={handleAiScan}
              onOpenDevelop={() => router.push(`/projects/${projectId}/design/develop`)}
              libraryFilter={libraryFilter}
              onLibraryFilter={setLibraryFilter}
              siteLayers={siteLayers}
              onToggleSiteLayer={(id) =>
                setSiteLayers((prev) => ({
                  ...prev,
                  [id]: { ...prev[id], on: !prev[id].on },
                }))
              }
            />
          }
          sitePanel={
            ribbonTab === "site" ? (
              <>
                <SiteLayersPanel
                  projectId={projectId}
                  projectAddress={projectAddress}
                  survey={surveyPick}
                  placements={placements}
                  symbols={symbols}
                  layers={siteLayers}
                  onToggle={(id) =>
                    setSiteLayers((prev) => ({
                      ...prev,
                      [id]: { ...prev[id], on: !prev[id].on },
                    }))
                  }
                  onOpacity={(id, opacity) =>
                    setSiteLayers((prev) => ({
                      ...prev,
                      [id]: { ...prev[id], opacity },
                    }))
                  }
                  conflictCount={0}
                />
                {siteLayers["sun-shade"].on ? (
                  <SunShadeControls
                    lat={surveyPick.lat ?? -37.81}
                    lng={surveyPick.lng ?? 144.96}
                    timeHour={sunTimeHour}
                    solstice={solstice}
                    onTimeHour={setSunTimeHour}
                    onSolstice={setSolstice}
                    zoomPercent={viewport.zoomPercent}
                    cursorPct={cursorPct}
                  />
                ) : null}
              </>
            ) : null
          }
          canvas={
            <div className={sh.rootFill}>
              {tier1Active ? <StudioTier1Banner projectId={projectId} /> : null}
              {canvasWorkspace}
            </div>
          }
          rightRail={desktopRightRail}
        />
      </StudioChromeProvider>
    );
  }

  return (
    <div className={sh.rootFill}>
      <StudioWorkflowBadge />
      {tier1Active ? <StudioTier1Banner projectId={projectId} /> : null}
      <StudioRibbon
        ribbonTab={ribbonTab}
        onRibbonTab={setRibbonTab}
        toolOverride={toolOverride}
        onTool={setStudioTool}
        zoomPercent={viewport.zoomPercent}
        onZoomIn={viewport.zoomIn}
        onZoomOut={viewport.zoomOut}
        onResetView={viewport.resetView}
        onOpenAiRail={() => setRailTab("ai")}
        canUndo={canUndo}
        onUndo={undo}
        onRedo={redo}
        canRedo={studio.canRedo}
        tier1={tier1Active}
        saveStatus={saveStatusNode}
        saveButton={saveButtonNode}
      />

      <PipelineImageShell
        testId="design-studio-image-shell"
        canvasColClassName={hasPlanningSymbol ? s.canvasColAdvisory : undefined}
        canvasCol={canvasWorkspace}
        rail={railPanels}
      />
    </div>
  );
}
