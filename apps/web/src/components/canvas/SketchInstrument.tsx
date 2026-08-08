"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type {
  BrushRecipe,
  CanvasStroke,
  CatalogPlacement,
  CatalogSymbol,
  DesignCanvas,
  GhostPlacementSuggestion,
} from "@workstream/contracts";
import {
  buildGhostPlacementSuggestions,
  buildSketchCanvasAiSuggestions,
  CATALOG_PLANNING_SYMBOL_IDS,
  jitterPlacement,
  pushSwatchHistory,
  recipeFromPlacement,
  SKETCH_RIBBON_STARTERS,
  snapPointPctToGrid,
  withDirtySaveSuggestion,
  emptyHistoryStacks,
  pushHistorySnapshot,
  undoHistory,
  redoHistory,
  diffMovedPlacements,
  diffRemovedPlacements,
  markStaleGhostsNearEdit,
  type StudioAiSuggestion,
} from "@workstream/domain";
import {
  getDesignCanvasAction,
  saveDesignCanvasAction,
  scanDesignGhostsAction,
  designAssistAction,
} from "../../app/actions";
import type { RateCardItem } from "../../lib/api";
import type { StaticMapView } from "../../lib/mapView";
import type { CanvasViewLayers } from "../../lib/canvas-view-layers";
import { ghostSizeFromMetres } from "./DraftingAssist";
import { SketchGhostLayer } from "./SketchGhostLayer";
import { CanvasCommandPalette } from "./CanvasCommandPalette";
import { useToast } from "../ToastHost";
import {
  beginMutation,
  commitPrecise,
  createMutationFsm,
  mutateHeuristic,
  resolveMutation,
  type MutationFsmState,
} from "../../lib/canvas-mutation-fsm";
import {
  publishMutationHud,
  requestOrchestrationRefresh,
} from "../../lib/canvas-mutation-bus";
import { DesignCanvasPlacement } from "../studio/DesignCanvasPlacement";
import { GhostCursor } from "../studio/GhostCursor";
import { SketchRibbon } from "./SketchRibbon";
import css from "./sketchInstrument.module.css";

type Props = {
  projectId: string;
  symbols: CatalogSymbol[];
  rateCard: RateCardItem[];
  initialPlacements: CatalogPlacement[];
  initialStrokes?: CanvasStroke[];
  onPlacementCount?: (n: number) => void;
  /** Fired after a successful persist with the full canvas (preserves features/irrigation). */
  onCanvasSaved?: (canvas: DesignCanvas) => void;
  /** Aerial map frame — sizes ghosts in real metres. */
  mapView?: StaticMapView | null;
  worldWidthPx?: number;
  worldHeightPx?: number;
  /** Tier-1 Wrights Terrace coaching path. */
  tier1?: boolean;
  showGhostSuggestions?: boolean;
  /** Promote sketch → working drawing on the same canvas. */
  onDraftCad?: () => void;
  /** Jump to quote lens (AI coaching "quote" action). */
  onGoToQuote?: () => void;
  onRegisterCommands?: (api: {
    scanGhosts: () => void;
    openCommands: () => void;
    undo: () => void;
    redo: () => void;
  }) => void;
  measureActive?: boolean;
  onToggleMeasure?: () => void;
  viewLayers?: CanvasViewLayers;
  onToggleViewLayer?: (key: keyof CanvasViewLayers) => void;
  /** Portal sketch ribbon into the geo canvas dock. */
  chromeHost?: HTMLElement | null;
  onArmedChange?: (armed: boolean) => void;
  showRibbon?: boolean;
  /** Edit/select mode — marquee + multi-select when brush not armed. */
  selectMode?: boolean;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

type TransformSession =
  | {
      kind: "rotate";
      id: string;
      startAngleRad: number;
      startRotation: number;
      cx: number;
      cy: number;
    }
  | {
      kind: "scale";
      id: string;
      startDist: number;
      startScale: number;
      cx: number;
      cy: number;
    };

const STRUCTURE_PLANT_RE =
  /pleached|olive|tree|canopy|hornbeam|existing-tree|nature-tree|wikimedia-tree/i;
const HARDSCAPE_CATS = new Set(["paving", "structure", "water", "furniture"]);

function recipeForSymbol(sym: CatalogSymbol): BrushRecipe {
  return {
    id: crypto.randomUUID(),
    symbol_id: sym.id,
    scale: 1,
    rotation_deg: 0,
    label: sym.label,
    copy_geometry: true,
    copy_material: true,
    copy_pricing: true,
  };
}

function newId(): string {
  return crypto.randomUUID();
}

function snapDragPct(
  xPct: number,
  yPct: number,
  others: CatalogPlacement[],
  excludeIds: Set<string>,
): { x_pct: number; y_pct: number; guideX?: number; guideY?: number } {
  const anchors = [25, 50, 75];
  let x = xPct;
  let y = yPct;
  let guideX: number | undefined;
  let guideY: number | undefined;
  const threshold = 1.25;
  for (const a of anchors) {
    if (Math.abs(xPct - a) < threshold) {
      x = a;
      guideX = a;
      break;
    }
  }
  for (const a of anchors) {
    if (Math.abs(yPct - a) < threshold) {
      y = a;
      guideY = a;
      break;
    }
  }
  for (const p of others) {
    if (excludeIds.has(p.id)) continue;
    if (guideX == null && Math.abs(xPct - p.x_pct) < threshold) {
      x = p.x_pct;
      guideX = p.x_pct;
    }
    if (guideY == null && Math.abs(yPct - p.y_pct) < threshold) {
      y = p.y_pct;
      guideY = p.y_pct;
    }
  }
  return { x_pct: x, y_pct: y, guideX, guideY };
}

type PaintSession = {
  active: boolean;
  lastX: number;
  lastY: number;
  stamped: number;
  baselineCount: number;
  unitCost: number;
};

/** Instrumental paint layer on the shared SiteCanvas world - no studio shell. */
export function SketchInstrument({
  projectId,
  symbols,
  rateCard,
  initialPlacements,
  initialStrokes = [],
  onPlacementCount,
  onCanvasSaved,
  mapView = null,
  worldWidthPx = 900,
  worldHeightPx = 640,
  tier1 = false,
  showGhostSuggestions = true,
  onDraftCad,
  onGoToQuote,
  onRegisterCommands,
  measureActive = false,
  onToggleMeasure,
  viewLayers,
  onToggleViewLayer,
  chromeHost = null,
  onArmedChange,
  showRibbon = true,
  selectMode = false,
}: Props) {
  const toast = useToast();
  const assistInputRef = useRef<HTMLTextAreaElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const placementsRef = useRef<CatalogPlacement[]>(initialPlacements);
  const mutationFsmRef = useRef(createMutationFsm());
  const paintRef = useRef<PaintSession | null>(null);
  const inkDraftRef = useRef<Array<{ x_pct: number; y_pct: number }> | null>(
    null,
  );
  const strokesRef = useRef<CanvasStroke[]>(initialStrokes);
  const heuristicAtRef = useRef(0);
  const dragRef = useRef<{
    ids: string[];
    startXpct: number;
    startYpct: number;
    startClientX: number;
    startClientY: number;
    origins: Map<string, { x_pct: number; y_pct: number }>;
  } | null>(null);
  const transformRef = useRef<TransformSession | null>(null);
  const historyRef = useRef(emptyHistoryStacks<CatalogPlacement[]>());
  const marqueeRef = useRef<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const [placements, setPlacements] = useState(initialPlacements);
  const [ephemeralGhosts, setEphemeralGhosts] = useState<
    Array<GhostPlacementSuggestion & { stale?: boolean }>
  >([]);
  const [ghostScanning, setGhostScanning] = useState(false);
  const [assistPending, setAssistPending] = useState(false);
  const [assistReply, setAssistReply] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [armedRecipe, setArmedRecipe] = useState<BrushRecipe | null>(null);
  const [inkMode, setInkMode] = useState(false);
  const [strokes, setStrokes] = useState<CanvasStroke[]>(initialStrokes);
  const [inkDraft, setInkDraft] = useState<
    Array<{ x_pct: number; y_pct: number }> | null
  >(null);
  const [swatchHistory, setSwatchHistory] = useState<BrushRecipe[]>([]);
  const [cursorPct, setCursorPct] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [alignGuides, setAlignGuides] = useState<{
    x?: number;
    y?: number;
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const startersReady = useRef(false);
  const ghostsBootstrapped = useRef(false);

  const symbolById = useMemo(
    () => new Map(symbols.map((s) => [s.id, s])),
    [symbols],
  );

  useEffect(() => {
    if (startersReady.current || symbols.length === 0) return;
    startersReady.current = true;
    const starters = SKETCH_RIBBON_STARTERS.map((id) => symbolById.get(id)).filter(
      (s): s is CatalogSymbol => Boolean(s),
    );
    if (starters.length === 0) return;
    setSwatchHistory(starters.map((s) => recipeForSymbol(s)));
  }, [symbolById, symbols.length]);

  useEffect(() => {
    placementsRef.current = placements;
    onPlacementCount?.(placements.length);
  }, [placements, onPlacementCount]);

  useEffect(() => {
    onArmedChange?.(armedRecipe != null || inkMode);
  }, [armedRecipe, inkMode, onArmedChange]);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const clientToPct = useCallback((clientX: number, clientY: number) => {
    const el = layerRef.current;
    if (!el) return { x_pct: 50, y_pct: 50 };
    const r = el.getBoundingClientRect();
    const raw = {
      x_pct: Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)),
      y_pct: Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100)),
    };
    return snapPointPctToGrid(raw.x_pct, raw.y_pct, 2.5, true);
  }, []);

  const syncMutationHud = useCallback((next: MutationFsmState) => {
    mutationFsmRef.current = next;
    publishMutationHud({
      phase: next.phase,
      optimisticCost: next.optimisticCost,
      pendingPrecise: next.pendingPrecise,
    });
  }, []);

  const unitCostForSymbol = useCallback(
    (symbolId: string) => {
      const sym = symbolById.get(symbolId);
      if (!sym?.rate_card_sku) return 40;
      return rateCard.find((r) => r.sku === sym.rate_card_sku)?.rate ?? 40;
    },
    [rateCard, symbolById],
  );

  const persist = useCallback(async () => {
    setSaveStatus("saving");
    try {
      // Preserve irrigation / features / strokes / annotations already on canvas.
      const existing = await getDesignCanvasAction(projectId);
      const saved = await saveDesignCanvasAction(
        projectId,
        placementsRef.current,
        strokesRef.current,
        existing?.irrigation_zones ?? [],
        existing?.annotations ?? [],
        existing?.features ?? [],
      );
      onCanvasSaved?.(saved.canvas);
      requestOrchestrationRefresh();
      setSaveStatus("saved");
      setLastSavedAt(new Date());
      setDirty(false);
      return true;
    } catch (err) {
      setSaveStatus("error");
      toast.show(
        err instanceof Error ? err.message : "Could not save sketch",
        "error",
        6000,
        {
          action: {
            label: "Retry",
            onClick: () => {
              void persist();
            },
          },
        },
      );
      return false;
    }
  }, [onCanvasSaved, projectId, toast]);

  const pushPlacementHistory = useCallback(() => {
    historyRef.current = pushHistorySnapshot(
      historyRef.current,
      structuredClone(placementsRef.current),
    );
  }, []);

  const applyPlacements = useCallback(
    (
      updater: (prev: CatalogPlacement[]) => CatalogPlacement[],
      opts?: { recordHistory?: boolean; staleFrom?: CatalogPlacement[] },
    ) => {
      const before = opts?.staleFrom ?? placementsRef.current;
      setPlacements((prev) => {
        const next = updater(prev);
        placementsRef.current = next;
        const removed = diffRemovedPlacements(before, next);
        const moved = diffMovedPlacements(before, next);
        if (removed.length || moved.length) {
          setEphemeralGhosts((ghosts) =>
            markStaleGhostsNearEdit(ghosts, [...removed, ...moved]),
          );
        }
        return next;
      });
      setDirty(true);
      if (opts?.recordHistory !== false) pushPlacementHistory();
    },
    [pushPlacementHistory],
  );

  const undoPlacements = useCallback(() => {
    const { stacks, state } = undoHistory(
      historyRef.current,
      placementsRef.current,
    );
    if (!state) return false;
    historyRef.current = stacks;
    placementsRef.current = state;
    setPlacements(state);
    setDirty(true);
    void persist();
    return true;
  }, [persist]);

  const redoPlacements = useCallback(() => {
    const { stacks, state } = redoHistory(
      historyRef.current,
      placementsRef.current,
    );
    if (!state) return false;
    historyRef.current = stacks;
    placementsRef.current = state;
    setPlacements(state);
    setDirty(true);
    void persist();
    return true;
  }, [persist]);

  const armBrush = useCallback((recipe: BrushRecipe) => {
    setInkMode(false);
    inkDraftRef.current = null;
    setInkDraft(null);
    setArmedRecipe(recipe);
    setSwatchHistory((h) => pushSwatchHistory(h, recipe));
  }, []);

  const toggleInkMode = useCallback(() => {
    setInkMode((prev) => {
      const next = !prev;
      if (next) setArmedRecipe(null);
      return next;
    });
    inkDraftRef.current = null;
    setInkDraft(null);
  }, []);

  const stampFromRecipe = useCallback(
    (
      xPct: number,
      yPct: number,
      withJitter: boolean,
      recipe?: BrushRecipe | null,
    ) => {
      const brush = recipe ?? armedRecipe;
      if (!brush) return;
      const pt = snapPointPctToGrid(xPct, yPct, 2.5, true);
      const jittered = withJitter
        ? jitterPlacement({
            scale: brush.scale,
            rotation_deg: brush.rotation_deg,
          })
        : { scale: brush.scale, rotation_deg: brush.rotation_deg };
      setPlacements((prev) => [
        ...prev,
        {
          id: newId(),
          symbol_id: brush.symbol_id,
          x_pct: pt.x_pct,
          y_pct: pt.y_pct,
          rotation_deg: brush.copy_geometry ? jittered.rotation_deg : 0,
          scale: brush.copy_geometry ? jittered.scale : 1,
        },
      ]);
      setDirty(true);
    },
    [armedRecipe],
  );

  const beginPaint = useCallback(
    (clientX: number, clientY: number) => {
      if (!armedRecipe) return;
      const unit = unitCostForSymbol(armedRecipe.symbol_id);
      const baselineCount = Math.max(placementsRef.current.length, 1);
      syncMutationHud(
        beginMutation(mutationFsmRef.current, baselineCount * unit, baselineCount),
      );
      const pt = clientToPct(clientX, clientY);
      paintRef.current = {
        active: true,
        lastX: pt.x_pct,
        lastY: pt.y_pct,
        stamped: 0,
        baselineCount,
        unitCost: unit,
      };
      stampFromRecipe(pt.x_pct, pt.y_pct, true, armedRecipe);
      paintRef.current.stamped = 1;
      heuristicAtRef.current = performance.now();
    },
    [armedRecipe, clientToPct, stampFromRecipe, syncMutationHud, unitCostForSymbol],
  );

  const continuePaint = useCallback(
    (clientX: number, clientY: number) => {
      const paint = paintRef.current;
      if (!paint?.active) return;
      const pt = clientToPct(clientX, clientY);
      const dist = Math.hypot(pt.x_pct - paint.lastX, pt.y_pct - paint.lastY);
      if (dist < 2.2) return;
      paint.lastX = pt.x_pct;
      paint.lastY = pt.y_pct;
      stampFromRecipe(pt.x_pct, pt.y_pct, true);
      paint.stamped += 1;
      const now = performance.now();
      if (now - heuristicAtRef.current >= 100) {
        heuristicAtRef.current = now;
        syncMutationHud(
          mutateHeuristic(
            mutationFsmRef.current,
            paint.baselineCount + paint.stamped,
          ),
        );
      }
    },
    [clientToPct, stampFromRecipe, syncMutationHud],
  );

  const endPaint = useCallback(() => {
    const paint = paintRef.current;
    if (!paint?.active) return;
    paintRef.current = null;
    syncMutationHud(resolveMutation(mutationFsmRef.current));
    const unitCost = paint.unitCost;
    const runPrecise = () => {
      void persist().then((ok) => {
        const precise =
          Math.round(placementsRef.current.length * unitCost * 100) / 100;
        syncMutationHud(commitPrecise(mutationFsmRef.current, precise));
        if (ok) requestOrchestrationRefresh();
      });
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(() => runPrecise());
    } else {
      setTimeout(runPrecise, 0);
    }
  }, [persist, syncMutationHud]);

  const samplePlacement = useCallback(
    (placement: CatalogPlacement) => {
      armBrush(
        recipeFromPlacement(
          placement,
          symbolById.get(placement.symbol_id),
        ),
      );
    },
    [armBrush, symbolById],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) {
        const recipe = swatchHistory[n - 1];
        if (recipe) {
          e.preventDefault();
          setArmedRecipe(recipe);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redoPlacements();
        else undoPlacements();
        return;
      }
      const activeIds =
        selectedIds.length > 0
          ? selectedIds
          : selectedId
            ? [selectedId]
            : [];
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        activeIds.length > 0
      ) {
        e.preventDefault();
        applyPlacements(
          (prev) => prev.filter((p) => !activeIds.includes(p.id)),
          { staleFrom: placementsRef.current },
        );
        setSelectedId(null);
        setSelectedIds([]);
        void persist();
      }
      if (
        activeIds.length > 0 &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 2.5 : 0.5;
        const dx =
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy =
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        applyPlacements(
          (prev) =>
            prev.map((p) =>
              activeIds.includes(p.id)
                ? {
                    ...p,
                    x_pct: Math.min(100, Math.max(0, p.x_pct + dx)),
                    y_pct: Math.min(100, Math.max(0, p.y_pct + dy)),
                  }
                : p,
            ),
          { staleFrom: placementsRef.current },
        );
        void persist();
      }
      if (e.key === "Escape") {
        setArmedRecipe(null);
        setSelectedId(null);
        setSelectedIds([]);
        setMarquee(null);
        marqueeRef.current = null;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    applyPlacements,
    persist,
    redoPlacements,
    selectedId,
    selectedIds,
    swatchHistory,
    undoPlacements,
  ]);

  const aiSuggestions = useMemo(() => {
    let hasPlanningSymbol = false;
    let hasHardscape = false;
    let hasStructurePlanting = false;
    for (const p of placements) {
      const sym = symbolById.get(p.symbol_id);
      if (!sym) continue;
      if (
        CATALOG_PLANNING_SYMBOL_IDS.has(sym.id) ||
        sym.id === "tree-root-protection"
      ) {
        hasPlanningSymbol = true;
      }
      if (HARDSCAPE_CATS.has(sym.category)) hasHardscape = true;
      if (
        sym.category === "planting" &&
        (STRUCTURE_PLANT_RE.test(sym.id) || STRUCTURE_PLANT_RE.test(sym.label))
      ) {
        hasStructurePlanting = true;
      }
    }
    return withDirtySaveSuggestion(
      buildSketchCanvasAiSuggestions({
        placementCount: placements.length,
        hasPlanningSymbol,
        hasHardscape,
        hasStructurePlanting,
        tier1,
        sketchReadyForCad: placements.length >= 3,
      }),
      dirty,
    );
  }, [dirty, placements, symbolById, tier1]);

  const armSymbol = useCallback(
    (sym: CatalogSymbol) => {
      armBrush(recipeForSymbol(sym));
    },
    [armBrush],
  );

  const handleAiAction = useCallback(
    (suggestion: StudioAiSuggestion) => {
      if (suggestion.action === "cad") {
        onDraftCad?.();
        return;
      }
      if (suggestion.action === "quote") {
        onGoToQuote?.();
        return;
      }
      if (suggestion.action === "save") {
        void persist();
        return;
      }
      const id = suggestion.symbol_id;
      if (!id) return;
      const sym = symbolById.get(id);
      if (sym) armSymbol(sym);
    },
    [armSymbol, onDraftCad, onGoToQuote, persist, symbolById],
  );

  const scanGhosts = useCallback(async () => {
    setGhostScanning(true);
    try {
      const symbolIds = symbols.map((s) => s.id);
      let suggestions: GhostPlacementSuggestion[] = [];
      try {
        const res = await scanDesignGhostsAction(projectId);
        suggestions = res.suggestions ?? [];
      } catch {
        suggestions = buildGhostPlacementSuggestions({ tier1, symbolIds });
      }
      if (suggestions.length === 0) {
        suggestions = buildGhostPlacementSuggestions({ tier1, symbolIds });
      }
      setEphemeralGhosts(suggestions);
      if (suggestions.length > 0) {
        toast.show(
          `${suggestions.length} AI suggestion${suggestions.length === 1 ? "" : "s"} on canvas — accept to commit`,
          "info",
          5000,
        );
      } else {
        toast.show("No layout suggestions for this aerial yet", "info");
      }
    } finally {
      setGhostScanning(false);
    }
  }, [projectId, symbols, tier1, toast]);

  const runAssist = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      setAssistPending(true);
      try {
        const res = await designAssistAction(projectId, trimmed);
        setAssistReply(res.reply);
        if (res.suggestions.length > 0) {
          setEphemeralGhosts(res.suggestions);
          toast.show(
            `${res.suggestions.length} AI suggestion${res.suggestions.length === 1 ? "" : "s"} — accept to commit`,
            "info",
            5000,
          );
        } else {
          toast.show(res.reply.slice(0, 120), "info", 5000);
        }
      } catch {
        const symbolIds = symbols.map((s) => s.id);
        const fallback = buildGhostPlacementSuggestions({ tier1, symbolIds });
        setEphemeralGhosts(fallback);
        setAssistReply("Using heuristic placements — accept ghosts to commit.");
        toast.show("Assist unavailable — heuristic ghosts placed", "info");
      } finally {
        setAssistPending(false);
      }
    },
    [projectId, symbols, tier1, toast],
  );

  const focusAssist = useCallback(() => {
    assistInputRef.current?.focus();
  }, []);

  useEffect(() => {
    onRegisterCommands?.({
      scanGhosts: () => void scanGhosts(),
      openCommands: () => setCommandOpen(true),
      undo: () => {
        undoPlacements();
      },
      redo: () => {
        redoPlacements();
      },
    });
  }, [onRegisterCommands, redoPlacements, scanGhosts, undoPlacements]);

  useEffect(() => {
    if (ghostsBootstrapped.current || placements.length > 0) return;
    ghostsBootstrapped.current = true;
    void scanGhosts();
  }, [placements.length, scanGhosts]);

  const acceptGhost = useCallback(
    (ghost: GhostPlacementSuggestion) => {
      const next: CatalogPlacement[] = [
        ...placementsRef.current,
        {
          id: crypto.randomUUID(),
          symbol_id: ghost.symbol_id,
          x_pct: ghost.x_pct,
          y_pct: ghost.y_pct,
          rotation_deg: 0,
          scale: 1,
        },
      ];
      placementsRef.current = next;
      setPlacements(next);
      setEphemeralGhosts((g) => g.filter((x) => x.id !== ghost.id));
      setDirty(true);
      void persist();
      toast.show("Suggestion accepted onto plan", "success");
    },
    [persist, toast],
  );

  const dismissGhost = useCallback((ghostId: string) => {
    setEphemeralGhosts((g) => g.filter((x) => x.id !== ghostId));
  }, []);

  const beginRotate = useCallback(
    (placementId: string, e: React.PointerEvent) => {
      const el = layerRef.current;
      const placement = placementsRef.current.find((p) => p.id === placementId);
      if (!el || !placement) return;
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      const cx = r.left + (placement.x_pct / 100) * r.width;
      const cy = r.top + (placement.y_pct / 100) * r.height;
      const startAngleRad = Math.atan2(e.clientY - cy, e.clientX - cx);
      transformRef.current = {
        kind: "rotate",
        id: placementId,
        startAngleRad,
        startRotation: placement.rotation_deg,
        cx,
        cy,
      };
    },
    [],
  );

  const beginScale = useCallback(
    (placementId: string, e: React.PointerEvent) => {
      const el = layerRef.current;
      const placement = placementsRef.current.find((p) => p.id === placementId);
      if (!el || !placement) return;
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      const cx = r.left + (placement.x_pct / 100) * r.width;
      const cy = r.top + (placement.y_pct / 100) * r.height;
      const startDist = Math.max(
        24,
        Math.hypot(e.clientX - cx, e.clientY - cy),
      );
      transformRef.current = {
        kind: "scale",
        id: placementId,
        startDist,
        startScale: placement.scale || 1,
        cx,
        cy,
      };
    },
    [],
  );

  const armedSym = armedRecipe
    ? symbolById.get(armedRecipe.symbol_id)
    : null;
  const brushWidthM =
    (armedSym?.default_width_m ?? 1.2) * (armedRecipe?.scale ?? 1);
  const ghostSizePx = ghostSizeFromMetres(
    brushWidthM,
    mapView,
    worldWidthPx,
    worldHeightPx,
  );

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-placement-id]")) return;

    if (inkMode) {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setArmedRecipe(null);
      const pt = clientToPct(e.clientX, e.clientY);
      inkDraftRef.current = [pt];
      setInkDraft([pt]);
      return;
    }

    if (armedRecipe) {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      beginPaint(e.clientX, e.clientY);
      return;
    }

    if (selectMode) {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const pt = clientToPct(e.clientX, e.clientY);
      marqueeRef.current = {
        x1: pt.x_pct,
        y1: pt.y_pct,
        x2: pt.x_pct,
        y2: pt.y_pct,
      };
      setMarquee(marqueeRef.current);
      setSelectedId(null);
      setSelectedIds([]);
      return;
    }
    setSelectedId(null);
    setSelectedIds([]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pt = clientToPct(e.clientX, e.clientY);
    setCursorPct({ x: pt.x_pct, y: pt.y_pct });

    if (inkDraftRef.current) {
      e.stopPropagation();
      const last = inkDraftRef.current[inkDraftRef.current.length - 1]!;
      if (Math.hypot(pt.x_pct - last.x_pct, pt.y_pct - last.y_pct) < 0.6) {
        return;
      }
      inkDraftRef.current = [...inkDraftRef.current, pt];
      setInkDraft(inkDraftRef.current);
      return;
    }

    if (paintRef.current?.active) {
      e.stopPropagation();
      continuePaint(e.clientX, e.clientY);
      return;
    }

    const drag = dragRef.current;
    const transform = transformRef.current;
    if (transform) {
      e.stopPropagation();
      if (transform.kind === "rotate") {
        const angle = Math.atan2(
          e.clientY - transform.cy,
          e.clientX - transform.cx,
        );
        const deltaDeg =
          ((angle - transform.startAngleRad) * 180) / Math.PI;
        setPlacements((prev) =>
          prev.map((p) =>
            p.id === transform.id
              ? {
                  ...p,
                  rotation_deg:
                    Math.round((transform.startRotation + deltaDeg) * 10) /
                    10,
                }
              : p,
          ),
        );
        setDirty(true);
        return;
      }
      if (transform.kind === "scale") {
        const dist = Math.max(
          24,
          Math.hypot(e.clientX - transform.cx, e.clientY - transform.cy),
        );
        const nextScale = Math.min(
          3,
          Math.max(0.25, transform.startScale * (dist / transform.startDist)),
        );
        setPlacements((prev) =>
          prev.map((p) =>
            p.id === transform.id
              ? { ...p, scale: Math.round(nextScale * 100) / 100 }
              : p,
          ),
        );
        setDirty(true);
        return;
      }
    }
    if (drag) {
      e.stopPropagation();
      const el = layerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = ((e.clientX - drag.startClientX) / r.width) * 100;
      const dy = ((e.clientY - drag.startClientY) / r.height) * 100;
      const exclude = new Set(drag.ids);
      applyPlacements(
        (prev) =>
          prev.map((p) => {
            if (!drag.ids.includes(p.id)) return p;
            const origin = drag.origins.get(p.id)!;
            const rawX = Math.min(100, Math.max(0, origin.x_pct + dx));
            const rawY = Math.min(100, Math.max(0, origin.y_pct + dy));
            const snapped = snapDragPct(rawX, rawY, prev, exclude);
            if (drag.ids[0] === p.id) {
              setAlignGuides({
                x: snapped.guideX,
                y: snapped.guideY,
              });
            }
            return {
              ...p,
              x_pct: snapped.x_pct,
              y_pct: snapped.y_pct,
            };
          }),
        { recordHistory: false, staleFrom: placementsRef.current },
      );
    }

    if (marqueeRef.current) {
      e.stopPropagation();
      const pt = clientToPct(e.clientX, e.clientY);
      const next = {
        ...marqueeRef.current,
        x2: pt.x_pct,
        y2: pt.y_pct,
      };
      marqueeRef.current = next;
      setMarquee(next);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (transformRef.current) {
      transformRef.current = null;
      void persist();
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
      return;
    }
    if (inkDraftRef.current) {
      const pts = inkDraftRef.current;
      inkDraftRef.current = null;
      setInkDraft(null);
      if (pts.length >= 2) {
        const stroke: CanvasStroke = {
          id: crypto.randomUUID(),
          points: pts,
          color: "#241318",
          width_px: 2.5,
        };
        setStrokes((prev) => {
          const next = [...prev, stroke];
          strokesRef.current = next;
          return next;
        });
        setDirty(true);
        void persist();
      }
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
      return;
    }
    if (paintRef.current?.active) {
      endPaint();
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
      return;
    }
    if (dragRef.current) {
      pushPlacementHistory();
      dragRef.current = null;
      setAlignGuides(null);
      setDirty(true);
      void persist();
    }
    if (marqueeRef.current) {
      const m = marqueeRef.current;
      marqueeRef.current = null;
      setMarquee(null);
      const left = Math.min(m.x1, m.x2);
      const right = Math.max(m.x1, m.x2);
      const top = Math.min(m.y1, m.y2);
      const bottom = Math.max(m.y1, m.y2);
      if (Math.abs(right - left) > 1.5 && Math.abs(bottom - top) > 1.5) {
        const ids = placementsRef.current
          .filter(
            (p) =>
              p.x_pct >= left &&
              p.x_pct <= right &&
              p.y_pct >= top &&
              p.y_pct <= bottom,
          )
          .map((p) => p.id);
        setSelectedIds(ids);
        setSelectedId(ids.length === 1 ? ids[0]! : null);
      }
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    }
  };

  const saveStatusLabel = useMemo(() => {
    if (saveStatus === "saving") return "Saving…";
    if (saveStatus === "error") return "Save failed";
    if (dirty) return "Unsaved changes";
    if (lastSavedAt) {
      return `Saved ${lastSavedAt.toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    return "Autosave on";
  }, [dirty, lastSavedAt, saveStatus]);

  return (
    <>
      <div
        ref={layerRef}
        className={`${css.layer} ${armedRecipe || inkMode ? css.layerArmed : ""} ${inkMode ? css.layerInk : ""} ${selectMode && !armedRecipe && !inkMode ? css.layerSelect : ""} ${showGhostSuggestions && (ephemeralGhosts.length > 0 || ghostScanning) ? css.layerGhosts : ""}`}
        data-testid="sketch-instrument"
        data-armed={armedRecipe || inkMode ? "1" : undefined}
        data-ink={inkMode ? "1" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg
          className={css.inkSvg}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
          data-testid="sketch-ink-layer"
        >
          {strokes.map((s) =>
            s.points.length < 2 ? null : (
              <polyline
                key={s.id}
                className={css.inkStroke}
                points={s.points
                  .map((p) => `${p.x_pct},${p.y_pct}`)
                  .join(" ")}
                stroke={s.color}
                strokeWidth={s.width_px * 0.08}
              />
            ),
          )}
          {inkDraft && inkDraft.length >= 2 ? (
            <polyline
              className={css.inkStrokeDraft}
              points={inkDraft.map((p) => `${p.x_pct},${p.y_pct}`).join(" ")}
            />
          ) : null}
        </svg>
        {alignGuides?.x != null ? (
          <div
            className={css.alignGuideV}
            style={{ left: `${alignGuides.x}%` }}
            aria-hidden
          />
        ) : null}
        {alignGuides?.y != null ? (
          <div
            className={css.alignGuideH}
            style={{ top: `${alignGuides.y}%` }}
            aria-hidden
          />
        ) : null}
        {marquee ? (
          <div
            className={css.marquee}
            style={{
              left: `${Math.min(marquee.x1, marquee.x2)}%`,
              top: `${Math.min(marquee.y1, marquee.y2)}%`,
              width: `${Math.abs(marquee.x2 - marquee.x1)}%`,
              height: `${Math.abs(marquee.y2 - marquee.y1)}%`,
            }}
            aria-hidden
          />
        ) : null}
        <SketchGhostLayer
          ghosts={showGhostSuggestions ? ephemeralGhosts : []}
          symbolById={symbolById}
          onAccept={acceptGhost}
          onDismiss={dismissGhost}
          scanning={showGhostSuggestions && ghostScanning}
        />
        {placements.map((p) => {
          const sym = symbolById.get(p.symbol_id);
          if (!sym) return null;
          const isTpz = p.symbol_id === "tree-root-protection";
          const widthM = (sym.default_width_m ?? 1.2) * (p.scale || 1);
          return (
            <DesignCanvasPlacement
              key={p.id}
              placement={p}
              symbol={sym}
              selected={selectedId === p.id || selectedIds.includes(p.id)}
              isTpz={isTpz}
              indicativeMetres={
                isTpz && mapView ? Math.round(widthM * 10) / 10 : null
              }
              onSelect={(ev) => {
                if (ev?.shiftKey) {
                  setSelectedIds((prev) =>
                    prev.includes(p.id)
                      ? prev.filter((id) => id !== p.id)
                      : [...prev, p.id],
                  );
                  setSelectedId(p.id);
                  return;
                }
                setSelectedIds([p.id]);
                setSelectedId(p.id);
              }}
              onAltSample={() => samplePlacement(p)}
              onMovePointerDown={(ev) => {
                pushPlacementHistory();
                const group =
                  selectedIds.includes(p.id) && selectedIds.length > 1
                    ? selectedIds
                    : [p.id];
                const origins = new Map(
                  placementsRef.current
                    .filter((x) => group.includes(x.id))
                    .map((x) => [x.id, { x_pct: x.x_pct, y_pct: x.y_pct }]),
                );
                dragRef.current = {
                  ids: group,
                  startXpct: p.x_pct,
                  startYpct: p.y_pct,
                  startClientX: ev.clientX,
                  startClientY: ev.clientY,
                  origins,
                };
              }}
              onRotateStart={(ev) => beginRotate(p.id, ev)}
              onScaleStart={(ev) => beginScale(p.id, ev)}
              onDelete={() => {
                applyPlacements(
                  (prev) => prev.filter((x) => x.id !== p.id),
                  { staleFrom: placementsRef.current },
                );
                setSelectedId(null);
                setSelectedIds((ids) => ids.filter((id) => id !== p.id));
                void persist();
              }}
            />
          );
        })}
        {armedRecipe && armedSym && cursorPct ? (
          <>
            <div
              className={css.snapGuides}
              style={{
                left: `${cursorPct.x}%`,
                top: `${cursorPct.y}%`,
              }}
              aria-hidden
            />
            <GhostCursor
              recipe={armedRecipe}
              symbol={armedSym}
              cursorPct={cursorPct}
              sizePx={ghostSizePx}
              sizeLabelM={brushWidthM}
            />
          </>
        ) : null}
      </div>

      {showRibbon
        ? (() => {
            const ribbon: ReactNode = (
              <SketchRibbon
                symbols={symbols}
                armedRecipe={armedRecipe}
                brushWidthM={brushWidthM}
                saveStatusLabel={saveStatusLabel}
                swatchHistory={swatchHistory}
                symbolById={symbolById}
                aiSuggestions={aiSuggestions}
                onArm={armSymbol}
                onSelectSwatch={(r) => {
                  setInkMode(false);
                  setArmedRecipe(r);
                }}
                onToggleCopy={(id, key) => {
                  setSwatchHistory((prev) =>
                    prev.map((r) => (r.id === id ? { ...r, [key]: !r[key] } : r)),
                  );
                  setArmedRecipe((cur) =>
                    cur && cur.id === id ? { ...cur, [key]: !cur[key] } : cur,
                  );
                }}
                onAiAction={handleAiAction}
                onDraftCad={() => onDraftCad?.()}
                onScanGhosts={() => void scanGhosts()}
                onOpenCommands={() => setCommandOpen(true)}
                onSubmitAssist={(msg) => void runAssist(msg)}
                assistReply={assistReply}
                assistPending={assistPending}
                assistInputRef={assistInputRef}
                ghostsActive={
                  showGhostSuggestions &&
                  (ephemeralGhosts.length > 0 || ghostScanning)
                }
                inkMode={inkMode}
                onToggleInk={toggleInkMode}
              />
            );
            if (chromeHost) return createPortal(ribbon, chromeHost);
            return ribbon;
          })()
        : null}

      <CanvasCommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        symbols={symbols}
        onArmSymbol={armSymbol}
        onScanGhosts={() => void scanGhosts()}
        onDraftCad={() => onDraftCad?.()}
        onGoToQuote={() => onGoToQuote?.()}
        onToggleMeasure={() => onToggleMeasure?.()}
        measureActive={measureActive}
        onFocusAssist={() => {
          setCommandOpen(false);
          focusAssist();
        }}
        onToggleShade={
          onToggleViewLayer ? () => onToggleViewLayer("shade") : undefined
        }
        onToggleEasements={
          onToggleViewLayer ? () => onToggleViewLayer("easements") : undefined
        }
        shadeActive={viewLayers?.shade ?? false}
        easementsActive={viewLayers?.easements ?? false}
      />
    </>
  );
}
