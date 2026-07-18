"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  jitterPlacement,
  pushSwatchHistory,
  recipeFromPlacement,
  SKETCH_RIBBON_STARTERS,
  snapPointPctToGrid,
  withDirtySaveSuggestion,
  type StudioAiSuggestion,
} from "@workstream/domain";
import { saveDesignCanvasAction, scanDesignGhostsAction, designAssistAction } from "../../app/actions";
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
  onRegisterCommands?: (api: { scanGhosts: () => void }) => void;
  measureActive?: boolean;
  onToggleMeasure?: () => void;
  viewLayers?: CanvasViewLayers;
  onToggleViewLayer?: (key: keyof CanvasViewLayers) => void;
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
}: Props) {
  const toast = useToast();
  const assistInputRef = useRef<HTMLTextAreaElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const placementsRef = useRef<CatalogPlacement[]>(initialPlacements);
  const mutationFsmRef = useRef(createMutationFsm());
  const paintRef = useRef<PaintSession | null>(null);
  const heuristicAtRef = useRef(0);
  const dragRef = useRef<{
    id: string;
    startXpct: number;
    startYpct: number;
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const transformRef = useRef<TransformSession | null>(null);

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        setPlacements((prev) => prev.filter((p) => p.id !== selectedId));
        setSelectedId(null);
        setDirty(true);
        void persist();
      }
      if (e.key === "Escape") {
        setArmedRecipe(null);
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persist, selectedId, swatchHistory]);

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
    onRegisterCommands?.({ scanGhosts: () => void scanGhosts() });
  }, [onRegisterCommands, scanGhosts]);

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

    if (armedRecipe) {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      beginPaint(e.clientX, e.clientY);
      return;
    }
    setSelectedId(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pt = clientToPct(e.clientX, e.clientY);
    setCursorPct({ x: pt.x_pct, y: pt.y_pct });

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
      setPlacements((prev) =>
        prev.map((p) =>
          p.id === drag.id
            ? {
                ...p,
                x_pct: Math.min(100, Math.max(0, drag.startXpct + dx)),
                y_pct: Math.min(100, Math.max(0, drag.startYpct + dy)),
              }
            : p,
        ),
      );
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
    if (paintRef.current?.active) {
      endPaint();
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
      return;
    }
    if (dragRef.current) {
      dragRef.current = null;
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
        className={`${css.layer} ${armedRecipe ? css.layerArmed : ""} ${showGhostSuggestions && (ephemeralGhosts.length > 0 || ghostScanning) ? css.layerGhosts : ""}`}
        data-testid="sketch-instrument"
        data-armed={armedRecipe ? "1" : undefined}
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
              selected={selectedId === p.id}
              isTpz={isTpz}
              indicativeMetres={
                isTpz && mapView ? Math.round(widthM * 10) / 10 : null
              }
              onSelect={() => setSelectedId(p.id)}
              onAltSample={() => samplePlacement(p)}
              onMovePointerDown={(ev) => {
                dragRef.current = {
                  id: p.id,
                  startXpct: p.x_pct,
                  startYpct: p.y_pct,
                  startClientX: ev.clientX,
                  startClientY: ev.clientY,
                };
              }}
              onRotateStart={(ev) => beginRotate(p.id, ev)}
              onScaleStart={(ev) => beginScale(p.id, ev)}
              onDelete={() => {
                setPlacements((prev) => prev.filter((x) => x.id !== p.id));
                setSelectedId(null);
                setDirty(true);
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
