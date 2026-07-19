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
  CatalogPlacement,
  CatalogSymbol,
  GhostPlacementSuggestion,
} from "@workstream/contracts";
import {
  buildGhostPlacementSuggestions,
  buildSketchCanvasAiSuggestions,
  CATALOG_PLANNING_SYMBOL_IDS,
  detectCanopyClustersFromImageData,
  jitterPlacement,
  markStaleGhostsNearEdit,
  pushSwatchHistory,
  recipeFromPlacement,
  SKETCH_RIBBON_STARTERS,
  snapDragPct,
  snapPointPctToGrid,
  withDirtySaveSuggestion,
  type SnapGuide,
  type StudioAiSuggestion,
} from "@workstream/domain";
import { saveDesignCanvasAction, scanDesignGhostsAction, designAssistAction } from "../../app/actions";
import type { RateCardItem } from "../../lib/api";
import type { StaticMapView } from "../../lib/mapView";
import type { CanvasViewLayers } from "../../lib/canvas-view-layers";
import {
  createCanvasHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type CanvasHistory,
} from "../../lib/canvas-history";
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
  onPlacementCount?: (n: number) => void;
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
  onRegisterCommands?: (api: { scanGhosts: () => void; openCommands: () => void }) => void;
  measureActive?: boolean;
  onToggleMeasure?: () => void;
  viewLayers?: CanvasViewLayers;
  onToggleViewLayer?: (key: keyof CanvasViewLayers) => void;
  /** Portal sketch ribbon into the geo canvas dock. */
  chromeHost?: HTMLElement | null;
  onArmedChange?: (armed: boolean) => void;
  showRibbon?: boolean;
  /** Edit tool — enable marquee multi-select. */
  selectMode?: boolean;
  /** Vegetation bucket opacity (0–1). */
  vegetationOpacity?: number;
  /** Same-origin aerial URL for pixel-cluster canopy heuristic. */
  aerialUrl?: string | null;
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
  onPlacementCount,
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
  vegetationOpacity = 1,
  aerialUrl = null,
}: Props) {
  const toast = useToast();
  const assistInputRef = useRef<HTMLTextAreaElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const placementsRef = useRef<CatalogPlacement[]>(initialPlacements);
  const mutationFsmRef = useRef(createMutationFsm());
  const paintRef = useRef<PaintSession | null>(null);
  const heuristicAtRef = useRef(0);
  const historyRef = useRef<CanvasHistory<CatalogPlacement[]>>(
    createCanvasHistory(),
  );
  const dragRef = useRef<{
    ids: string[];
    origins: Array<{ id: string; x_pct: number; y_pct: number }>;
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const transformRef = useRef<TransformSession | null>(null);
  const marqueeRef = useRef<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);

  const [placements, setPlacements] = useState(initialPlacements);
  const [ephemeralGhosts, setEphemeralGhosts] = useState<
    GhostPlacementSuggestion[]
  >([]);
  const [ghostScanning, setGhostScanning] = useState(false);
  const [assistPending, setAssistPending] = useState(false);
  const [assistReply, setAssistReply] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [armedRecipe, setArmedRecipe] = useState<BrushRecipe | null>(null);
  const [swatchHistory, setSwatchHistory] = useState<BrushRecipe[]>([]);
  const [cursorPct, setCursorPct] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [marqueeBox, setMarqueeBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [alignGuides, setAlignGuides] = useState<SnapGuide[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const startersReady = useRef(false);
  const ghostsBootstrapped = useRef(false);

  const recordHistory = useCallback(() => {
    historyRef.current = pushHistory(
      historyRef.current,
      placementsRef.current.map((p) => ({ ...p })),
    );
  }, []);

  const flagStaleNear = useCallback((points: Array<{ x_pct: number; y_pct: number }>) => {
    if (points.length === 0) return;
    setEphemeralGhosts((g) => markStaleGhostsNearEdit(g, points));
  }, []);

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
    onArmedChange?.(armedRecipe != null);
  }, [armedRecipe, onArmedChange]);

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
      await saveDesignCanvasAction(
        projectId,
        placementsRef.current,
        [],
        [],
        [],
      );
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
  }, [projectId, toast]);

  const armBrush = useCallback((recipe: BrushRecipe) => {
    setArmedRecipe(recipe);
    setSwatchHistory((h) => pushSwatchHistory(h, recipe));
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
      recordHistory();
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
    [
      armedRecipe,
      clientToPct,
      recordHistory,
      stampFromRecipe,
      syncMutationHud,
      unitCostForSymbol,
    ],
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const result = undoHistory(historyRef.current, placementsRef.current);
        if (!result) return;
        e.preventDefault();
        historyRef.current = result.history;
        placementsRef.current = result.snapshot;
        setPlacements(result.snapshot);
        setDirty(true);
        void persist();
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key.toLowerCase() === "y" ||
          (e.key.toLowerCase() === "z" && e.shiftKey))
      ) {
        const result = redoHistory(historyRef.current, placementsRef.current);
        if (!result) return;
        e.preventDefault();
        historyRef.current = result.history;
        placementsRef.current = result.snapshot;
        setPlacements(result.snapshot);
        setDirty(true);
        void persist();
        return;
      }
      if (
        (e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight") &&
        selectedIds.length > 0
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.2;
        const dx =
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy =
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        recordHistory();
        const ids = new Set(selectedIds);
        const editPts: Array<{ x_pct: number; y_pct: number }> = [];
        setPlacements((prev) =>
          prev.map((p) => {
            if (!ids.has(p.id)) return p;
            const next = {
              ...p,
              x_pct: Math.min(100, Math.max(0, p.x_pct + dx)),
              y_pct: Math.min(100, Math.max(0, p.y_pct + dy)),
            };
            editPts.push({ x_pct: next.x_pct, y_pct: next.y_pct });
            return next;
          }),
        );
        flagStaleNear(editPts);
        setDirty(true);
        void persist();
        return;
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length > 0
      ) {
        e.preventDefault();
        const ids = new Set(selectedIds);
        const removed = placementsRef.current.filter((p) => ids.has(p.id));
        recordHistory();
        setPlacements((prev) => prev.filter((p) => !ids.has(p.id)));
        setSelectedIds([]);
        flagStaleNear(
          removed.map((p) => ({ x_pct: p.x_pct, y_pct: p.y_pct })),
        );
        setDirty(true);
        void persist();
      }
      if (e.key === "Escape") {
        setArmedRecipe(null);
        setSelectedIds([]);
        setMarqueeBox(null);
        marqueeRef.current = null;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flagStaleNear, persist, recordHistory, selectedIds, swatchHistory]);

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

  const scanCanopyClusters = useCallback(async (): Promise<
    GhostPlacementSuggestion[]
  > => {
    if (!aerialUrl || typeof document === "undefined") return [];
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("aerial load failed"));
        img.src = aerialUrl;
      });
      const size = 96;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return [];
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size);
      return detectCanopyClustersFromImageData({
        width: data.width,
        height: data.height,
        data: data.data,
      });
    } catch {
      return [];
    }
  }, [aerialUrl]);

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
      const canopy = await scanCanopyClusters();
      if (canopy.length) {
        const seen = new Set(suggestions.map((s) => `${s.x_pct}|${s.y_pct}`));
        for (const c of canopy) {
          const key = `${Math.round(c.x_pct)}|${Math.round(c.y_pct)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          suggestions.push(c);
        }
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
  }, [projectId, scanCanopyClusters, symbols, tier1, toast]);

  const ghostCostHint = useCallback(
    (ghost: GhostPlacementSuggestion): string | null => {
      const sym = symbolById.get(ghost.symbol_id);
      if (!sym?.rate_card_sku) return null;
      const rate =
        rateCard.find((r) => r.sku === sym.rate_card_sku)?.rate ?? null;
      if (rate == null) return null;
      const qty =
        sym.category === "paving" || sym.category === "structure"
          ? Math.max(0.5, (sym.default_width_m ?? 1) ** 2)
          : 1;
      const add = Math.round(qty * rate);
      return `Adds ~$${add.toLocaleString("en-AU")} (ex GST)`;
    },
    [rateCard, symbolById],
  );

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
    });
  }, [onRegisterCommands, scanGhosts]);

  useEffect(() => {
    if (ghostsBootstrapped.current || placements.length > 0) return;
    ghostsBootstrapped.current = true;
    void scanGhosts();
  }, [placements.length, scanGhosts]);

  const acceptGhost = useCallback(
    (ghost: GhostPlacementSuggestion) => {
      recordHistory();
      const unit = unitCostForSymbol(ghost.symbol_id);
      const baseline = placementsRef.current.length * unit;
      syncMutationHud(
        beginMutation(mutationFsmRef.current, baseline, placementsRef.current.length),
      );
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
      syncMutationHud(
        mutateHeuristic(mutationFsmRef.current, next.length),
      );
      void persist().then((ok) => {
        const precise = Math.round(next.length * unit * 100) / 100;
        syncMutationHud(commitPrecise(mutationFsmRef.current, precise));
        if (ok) requestOrchestrationRefresh();
      });
      const hint = ghostCostHint(ghost);
      toast.show(
        hint ? `Suggestion accepted — ${hint}` : "Suggestion accepted onto plan",
        "success",
      );
    },
    [
      ghostCostHint,
      persist,
      recordHistory,
      syncMutationHud,
      toast,
      unitCostForSymbol,
    ],
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
        x0: pt.x_pct,
        y0: pt.y_pct,
        x1: pt.x_pct,
        y1: pt.y_pct,
      };
      setMarqueeBox({
        left: pt.x_pct,
        top: pt.y_pct,
        width: 0,
        height: 0,
      });
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) setSelectedIds([]);
      return;
    }

    setSelectedIds([]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pt = clientToPct(e.clientX, e.clientY);
    setCursorPct({ x: pt.x_pct, y: pt.y_pct });

    if (paintRef.current?.active) {
      e.stopPropagation();
      continuePaint(e.clientX, e.clientY);
      return;
    }

    const marquee = marqueeRef.current;
    if (marquee) {
      e.stopPropagation();
      marquee.x1 = pt.x_pct;
      marquee.y1 = pt.y_pct;
      const left = Math.min(marquee.x0, marquee.x1);
      const top = Math.min(marquee.y0, marquee.y1);
      const width = Math.abs(marquee.x1 - marquee.x0);
      const height = Math.abs(marquee.y1 - marquee.y0);
      setMarqueeBox({ left, top, width, height });
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
      const primary = drag.origins[0]!;
      const others = placementsRef.current
        .filter((p) => !drag.ids.includes(p.id))
        .map((p) => ({ id: p.id, x_pct: p.x_pct, y_pct: p.y_pct }));
      const snapped = snapDragPct(
        primary.x_pct + dx,
        primary.y_pct + dy,
        others,
      );
      const snapDx = snapped.x_pct - primary.x_pct;
      const snapDy = snapped.y_pct - primary.y_pct;
      setAlignGuides(snapped.guides);
      const byId = new Map(drag.origins.map((o) => [o.id, o]));
      setPlacements((prev) =>
        prev.map((p) => {
          const origin = byId.get(p.id);
          if (!origin) return p;
          return {
            ...p,
            x_pct: Math.min(100, Math.max(0, origin.x_pct + snapDx)),
            y_pct: Math.min(100, Math.max(0, origin.y_pct + snapDy)),
          };
        }),
      );
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (transformRef.current) {
      const t = transformRef.current;
      transformRef.current = null;
      const p = placementsRef.current.find((x) => x.id === t.id);
      if (p) flagStaleNear([{ x_pct: p.x_pct, y_pct: p.y_pct }]);
      void persist();
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
    if (marqueeRef.current) {
      const m = marqueeRef.current;
      marqueeRef.current = null;
      setMarqueeBox(null);
      const left = Math.min(m.x0, m.x1);
      const right = Math.max(m.x0, m.x1);
      const top = Math.min(m.y0, m.y1);
      const bottom = Math.max(m.y0, m.y1);
      const hit = placementsRef.current
        .filter(
          (p) =>
            p.x_pct >= left &&
            p.x_pct <= right &&
            p.y_pct >= top &&
            p.y_pct <= bottom,
        )
        .map((p) => p.id);
      setSelectedIds((prev) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          return Array.from(new Set([...prev, ...hit]));
        }
        return hit;
      });
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
      return;
    }
    if (dragRef.current) {
      const drag = dragRef.current;
      dragRef.current = null;
      setAlignGuides([]);
      const moved = placementsRef.current.filter((p) => drag.ids.includes(p.id));
      flagStaleNear(moved.map((p) => ({ x_pct: p.x_pct, y_pct: p.y_pct })));
      setDirty(true);
      void persist();
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
        className={`${css.layer} ${armedRecipe ? css.layerArmed : ""} ${selectMode ? css.layerSelect : ""} ${showGhostSuggestions && (ephemeralGhosts.length > 0 || ghostScanning) ? css.layerGhosts : ""}`}
        data-testid="sketch-instrument"
        data-armed={armedRecipe ? "1" : undefined}
        data-select-mode={selectMode ? "1" : undefined}
        style={{ opacity: Math.max(0, Math.min(1, vegetationOpacity)) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <SketchGhostLayer
          ghosts={showGhostSuggestions ? ephemeralGhosts : []}
          symbolById={symbolById}
          onAccept={acceptGhost}
          onDismiss={dismissGhost}
          scanning={showGhostSuggestions && ghostScanning}
          costHintFor={ghostCostHint}
        />
        {placements.map((p) => {
          const sym = symbolById.get(p.symbol_id);
          if (!sym) return null;
          const isTpz = p.symbol_id === "tree-root-protection";
          const widthM = (sym.default_width_m ?? 1.2) * (p.scale || 1);
          const selected = selectedIds.includes(p.id);
          return (
            <DesignCanvasPlacement
              key={p.id}
              placement={p}
              symbol={sym}
              selected={selected}
              isTpz={isTpz}
              indicativeMetres={
                isTpz && mapView ? Math.round(widthM * 10) / 10 : null
              }
              onSelect={() =>
                setSelectedIds((prev) =>
                  prev.includes(p.id) ? prev : [p.id],
                )
              }
              onAltSample={() => samplePlacement(p)}
              onMovePointerDown={(ev) => {
                recordHistory();
                const group =
                  selectedIds.includes(p.id) && selectedIds.length > 1
                    ? selectedIds
                    : [p.id];
                setSelectedIds(group);
                dragRef.current = {
                  ids: group,
                  origins: placementsRef.current
                    .filter((x) => group.includes(x.id))
                    .map((x) => ({
                      id: x.id,
                      x_pct: x.x_pct,
                      y_pct: x.y_pct,
                    })),
                  startClientX: ev.clientX,
                  startClientY: ev.clientY,
                };
              }}
              onRotateStart={(ev) => {
                recordHistory();
                beginRotate(p.id, ev);
              }}
              onScaleStart={(ev) => {
                recordHistory();
                beginScale(p.id, ev);
              }}
              onDelete={() => {
                recordHistory();
                setPlacements((prev) => prev.filter((x) => x.id !== p.id));
                setSelectedIds((ids) => ids.filter((id) => id !== p.id));
                flagStaleNear([{ x_pct: p.x_pct, y_pct: p.y_pct }]);
                setDirty(true);
                void persist();
              }}
            />
          );
        })}
        {alignGuides.map((g) => (
          <div
            key={`${g.axis}-${g.sourceId}-${g.pct}`}
            className={
              g.axis === "x" ? css.alignGuideX : css.alignGuideY
            }
            style={
              g.axis === "x"
                ? { left: `${g.pct}%` }
                : { top: `${g.pct}%` }
            }
            aria-hidden
          />
        ))}
        {marqueeBox ? (
          <div
            className={css.marquee}
            data-testid="sketch-marquee"
            style={{
              left: `${marqueeBox.left}%`,
              top: `${marqueeBox.top}%`,
              width: `${marqueeBox.width}%`,
              height: `${marqueeBox.height}%`,
            }}
            aria-hidden
          />
        ) : null}
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
                onSelectSwatch={(r) => setArmedRecipe(r)}
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
