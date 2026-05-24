"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  canvasStrokeToPathD,
  strokePointsToPathD,
  type StrokePointPct,
} from "@workstream/domain";
import { CATALOG_PLANNING_SYMBOL_IDS } from "@workstream/domain";
import type { CatalogPlacement, CatalogSymbol } from "../lib/api";
import {
  placementIndicativeMetres,
  resolveStaticMapView,
  type StaticMapView,
} from "../lib/mapView";
import { saveDesignCanvasAction } from "../app/actions";
import { useToast } from "./ToastHost";
import {
  DesignAssetPalette,
  DesignCanvasPlacement,
  KeyboardLegend,
  ScaleBar,
} from "./studio";
import s from "./designStudio.module.css";

export type CanvasStrokeClient = {
  id: string;
  points: StrokePointPct[];
  color: string;
  width_px: number;
};

type ToolOverride = "place" | "draw" | "select" | null;

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

function clientPct(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): StrokePointPct {
  return {
    x_pct: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
    y_pct: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
  };
}

function pointerAngleDeg(
  rect: DOMRect,
  clientX: number,
  clientY: number,
  xPct: number,
  yPct: number,
): number {
  const cx = rect.left + (xPct / 100) * rect.width;
  const cy = rect.top + (yPct / 100) * rect.height;
  return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
}

function pointerDist(
  rect: DOMRect,
  clientX: number,
  clientY: number,
  xPct: number,
  yPct: number,
): number {
  const cx = rect.left + (xPct / 100) * rect.width;
  const cy = rect.top + (yPct / 100) * rect.height;
  return Math.hypot(clientX - cx, clientY - cy);
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
};

export function DesignStudio({
  projectId,
  aerialUri,
  lotRing = [],
  symbols,
  initialPlacements,
  initialStrokes,
}: Props) {
  const toast = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const pendingPlaceRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const drawingRef = useRef(false);
  const savingRef = useRef(false);
  const armedSymbolRef = useRef<string | null>(null);

  const [toolOverride, setToolOverride] = useState<ToolOverride>(null);
  const [placements, setPlacements] =
    useState<CatalogPlacement[]>(initialPlacements);
  const [strokes, setStrokes] = useState<CanvasStrokeClient[]>(initialStrokes);
  const [draftPoints, setDraftPoints] = useState<StrokePointPct[]>([]);
  const [armedSymbolId, setArmedSymbolId] = useState<string | null>(null);
  const [paletteSelectedId, setPaletteSelectedId] = useState<string | null>(null);
  const [dragSymbolId, setDragSymbolId] = useState<string | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [lastSavedLabel, setLastSavedLabel] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 280 });
  const [aerialError, setAerialError] = useState(false);
  const [aerialKey, setAerialKey] = useState(0);
  const [cursorHint, setCursorHint] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const setArmedSymbol = useCallback((id: string | null) => {
    armedSymbolRef.current = id;
    setArmedSymbolId(id);
  }, []);

  const mapView: StaticMapView = useMemo(
    () => resolveStaticMapView(aerialUri, lotRing),
    [aerialUri, lotRing],
  );

  const symbolById = useMemo(
    () => new Map(symbols.map((sym) => [sym.id, sym])),
    [symbols],
  );

  const hasPlanningSymbol = placements.some((p) =>
    CATALOG_PLANNING_SYMBOL_IDS.has(p.symbol_id),
  );

  const isDrawMode = toolOverride === "draw";
  const canUndoStroke = draftPoints.length > 0 || strokes.length > 0;

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

  const updatePlacement = useCallback(
    (id: string, patch: Partial<CatalogPlacement>) => {
      setPlacements((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
    },
    [],
  );

  const deletePlacement = useCallback((id: string) => {
    setPlacements((prev) => prev.filter((p) => p.id !== id));
    setSelectedPlacementId((cur) => (cur === id ? null : cur));
  }, []);

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
    [],
  );

  const placeOnCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const el = canvasRef.current;
      if (!el) return;
      const symbolId = dragSymbolId ?? armedSymbolRef.current;
      if (!symbolId) return;
      if (toolOverride === "select") return;
      const rect = el.getBoundingClientRect();
      const pt = clientPct(clientX, clientY, rect);
      addPlacement(symbolId, pt.x_pct, pt.y_pct);
      setDragSymbolId(null);
    },
    [addPlacement, dragSymbolId, toolOverride],
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
  }, [draftPoints]);

  const undo = useCallback(() => {
    if (draftPoints.length > 0) {
      setDraftPoints([]);
      return;
    }
    setStrokes((prev) => prev.slice(0, -1));
  }, [draftPoints.length]);

  const clearStrokes = useCallback(() => {
    if (strokes.length === 0) return;
    const snapshot = [...strokes];
    setStrokes([]);
    toast.show(`Cleared ${snapshot.length} markup stroke(s).`, "info", 6000, {
      action: { label: "Undo", onClick: () => setStrokes(snapshot) },
    });
  }, [strokes, toast]);

  const clearPlacements = useCallback(() => {
    if (placements.length === 0) return;
    const snapshot = [...placements];
    setPlacements([]);
    setSelectedPlacementId(null);
    toast.show(`Cleared ${snapshot.length} symbol(s).`, "info", 6000, {
      action: {
        label: "Undo",
        onClick: () => setPlacements(snapshot),
      },
    });
  }, [placements, toast]);

  const handlePaletteSelect = useCallback(
    (id: string) => {
      setPaletteSelectedId(id);
      if (toolOverride !== "select") {
        setArmedSymbol(id);
      }
    },
    [setArmedSymbol, toolOverride],
  );

  const updateCursorHint = useCallback(
    (clientX: number, clientY: number) => {
      if (dragRef.current) return;
      const el = canvasRef.current;
      if (!el || isDrawMode) {
        setCursorHint(null);
        return;
      }
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
    [armedSymbolId, isDrawMode, placements, selectedPlacementId, symbolById],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        setSelectedPlacementId(null);
        setArmedSymbol(null);
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
        undo();
        return;
      }
      if (e.key.toLowerCase() === "p") {
        setToolOverride("place");
        return;
      }
      if (e.key.toLowerCase() === "d") {
        setToolOverride("draw");
        setSelectedPlacementId(null);
        return;
      }
      if (e.key.toLowerCase() === "v") {
        setToolOverride("select");
        setArmedSymbol(null);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deletePlacement, selectedPlacementId, setArmedSymbol, undo]);

  function handleCanvasPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (isDrawMode) {
      const el = canvasRef.current;
      if (!el) return;
      drawingRef.current = true;
      el.setPointerCapture(e.pointerId);
      const rect = el.getBoundingClientRect();
      setDraftPoints([clientPct(e.clientX, e.clientY, rect)]);
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
    if (drawingRef.current && isDrawMode) {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pt = clientPct(e.clientX, e.clientY, rect);
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
    const el = canvasRef.current;
    if (drag && el) {
      const rect = el.getBoundingClientRect();
      if (drag.kind === "move") {
        const dx = ((e.clientX - drag.startClientX) / rect.width) * 100;
        const dy = ((e.clientY - drag.startClientY) / rect.height) * 100;
        updatePlacement(drag.id, {
          x_pct: Math.min(100, Math.max(0, drag.startXpct + dx)),
          y_pct: Math.min(100, Math.max(0, drag.startYpct + dy)),
        });
      } else if (drag.kind === "rotate") {
        const angle = pointerAngleDeg(
          rect,
          e.clientX,
          e.clientY,
          drag.centerXpct,
          drag.centerYpct,
        );
        updatePlacement(drag.id, {
          rotation_deg: (drag.startRot + angle - drag.startAngle + 360) % 360,
        });
      } else if (drag.kind === "scale") {
        const dist = pointerDist(
          rect,
          e.clientX,
          e.clientY,
          drag.centerXpct,
          drag.centerYpct,
        );
        const next = Math.min(4, Math.max(0.35, drag.startScale * (dist / drag.startDist)));
        updatePlacement(drag.id, { scale: next });
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
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      kind: "rotate",
      id,
      centerXpct: placement.x_pct,
      centerYpct: placement.y_pct,
      startAngle: pointerAngleDeg(
        rect,
        e.clientX,
        e.clientY,
        placement.x_pct,
        placement.y_pct,
      ),
      startRot: placement.rotation_deg,
    };
    el.setPointerCapture(e.pointerId);
  }

  function startScaleDrag(id: string, e: React.PointerEvent) {
    pendingPlaceRef.current = null;
    const el = canvasRef.current;
    const placement = placements.find((p) => p.id === id);
    if (!el || !placement) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      kind: "scale",
      id,
      centerXpct: placement.x_pct,
      centerYpct: placement.y_pct,
      startDist: pointerDist(
        rect,
        e.clientX,
        e.clientY,
        placement.x_pct,
        placement.y_pct,
      ),
      startScale: placement.scale,
    };
    el.setPointerCapture(e.pointerId);
  }

  async function handleSave() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await saveDesignCanvasAction(projectId, placements, strokes);
      setLastSavedLabel(
        new Date().toLocaleTimeString("en-AU", {
          hour: "numeric",
          minute: "2-digit",
        }),
      );
      toast.show(
        "Saved — concept ready for envelope estimate. Send to draftsperson for working drawings.",
        "success",
      );
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const draftPath =
    draftPoints.length >= 2
      ? strokePointsToPathD(
          draftPoints,
          canvasSize.width,
          canvasSize.height,
          2,
        )
      : "";

  const canvasEmpty = placements.length === 0 && strokes.length === 0;

  return (
    <div className={s.root}>
      <div className={s.toolbar} role="toolbar" aria-label="Design tools">
        <div className={s.modeFallback}>
          <span className={s.modeFallbackLabel}>Fallback modes</span>
          <div className={s.modeGroup}>
            <button
              type="button"
              className={`${s.modeBtn} ${toolOverride === null ? s.modeBtnAutoActive : ""}`}
              aria-pressed={toolOverride === null}
              onClick={() => setToolOverride(null)}
            >
              Auto
            </button>
            <button
              type="button"
              className={`${s.modeBtn} ${toolOverride === "place" ? s.modeBtnActive : ""}`}
              aria-pressed={toolOverride === "place"}
              onClick={() => setToolOverride("place")}
            >
              Place
            </button>
            <button
              type="button"
              className={`${s.modeBtn} ${toolOverride === "draw" ? s.modeBtnActive : ""}`}
              aria-pressed={toolOverride === "draw"}
              onClick={() => {
                setToolOverride("draw");
                setSelectedPlacementId(null);
              }}
            >
              Draw
            </button>
            <button
              type="button"
              className={`${s.modeBtn} ${toolOverride === "select" ? s.modeBtnAutoActive : ""}`}
              aria-pressed={toolOverride === "select"}
              onClick={() => {
                setToolOverride("select");
                setArmedSymbol(null);
              }}
            >
              Select
            </button>
          </div>
        </div>
        <KeyboardLegend />
        <div className={s.toolbarDestructive}>
          <button
            type="button"
            className={s.toolBtn}
            onClick={undo}
            disabled={!canUndoStroke}
            aria-disabled={!canUndoStroke}
          >
            Undo stroke
          </button>
          <button type="button" className={s.toolBtn} onClick={clearStrokes}>
            Clear markup
          </button>
          <button type="button" className={s.toolBtn} onClick={clearPlacements}>
            Clear symbols
          </button>
        </div>
        <span className={s.counts} data-testid="design-studio-counts">
          {placements.length} symbols · {strokes.length} strokes
        </span>
        <div className={s.toolbarActions}>
          <span className={s.saveStatus} aria-live="polite">
            {saving
              ? "Saving…"
              : lastSavedLabel
                ? `All changes saved ${lastSavedLabel}`
                : "Unsaved changes"}
          </span>
          <button
            type="button"
            className={s.btnPrimary}
            disabled={saving}
            onClick={() => void handleSave()}
            data-testid="design-studio-save"
          >
            {saving ? "Saving…" : "Save plan"}
          </button>
        </div>
      </div>

      {hasPlanningSymbol ? (
        <p className={s.tpzAdvisory} role="status">
          Tree protection symbols present — confirm against arborist report and council
          requirements before build.
        </p>
      ) : null}

      <div className={s.workspace}>
        <div className={s.canvasCol}>
          <p className={s.helper}>
            {isDrawMode
              ? "Markup with mouse, trackpad, or stylus — survey ink (concept sketch only)."
              : toolOverride === "select"
                ? "Select symbols to move, rotate, or scale. Delete removes the selection."
                : "Pick an asset, then click the aerial to place — or drag from the library."}
          </p>

          <div
            ref={canvasRef}
            className={`${s.canvas} ${isDrawMode ? s.canvasDraw : s.canvasPlace}`}
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
              /* Mapbox static satellite URL from survey — not user-uploaded input. */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={aerialKey}
                src={aerialUri}
                alt=""
                className={s.aerial}
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
                  d={canvasStrokeToPathD(
                    stroke,
                    canvasSize.width,
                    canvasSize.height,
                  )}
                  fill={markupStrokeClass(stroke.color) ? undefined : stroke.color}
                />
              ))}
              {draftPath ? <path d={draftPath} className={s.markupStroke} /> : null}
            </svg>
            {placements.map((p) => {
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
                    isTpz
                      ? placementIndicativeMetres(baseM, p.scale)
                      : null
                  }
                  onSelect={() => setSelectedPlacementId(p.id)}
                  onMovePointerDown={(e) => beginPlacementDrag(p.id, e)}
                  onRotateStart={(e) => startRotateDrag(p.id, e)}
                  onScaleStart={(e) => startScaleDrag(p.id, e)}
                  onDelete={() => deletePlacement(p.id)}
                />
              );
            })}
            {canvasEmpty && !isDrawMode ? (
              <div className={s.emptyPrompt}>
                <p>Select an asset and click the aerial to begin your concept sketch.</p>
              </div>
            ) : null}
            {cursorHint && !isDrawMode ? (
              <div
                className={s.contextLabel}
                style={{ left: cursorHint.x, top: cursorHint.y }}
                aria-hidden
              >
                {cursorHint.text}
              </div>
            ) : null}
            <ScaleBar mapView={mapView} canvasWidthPx={canvasSize.width} />
          </div>
          <p className={s.honestyCaption}>
            Concept sketch for estimating — not a construction drawing.
          </p>
        </div>

        <DesignAssetPalette
          symbols={symbols}
          selectedId={paletteSelectedId}
          disabled={isDrawMode}
          onSelect={handlePaletteSelect}
          onDragStart={(id) => {
            setDragSymbolId(id);
            setArmedSymbol(id);
          }}
          onDragEnd={() => setDragSymbolId(null)}
        />
      </div>
    </div>
  );
}
