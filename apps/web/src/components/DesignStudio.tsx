"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  canvasStrokeToPathD,
  strokePointsToPathD,
  type StrokePointPct,
} from "@workstream/domain";
import type { CatalogPlacement, CatalogSymbol } from "../lib/api";
import { saveDesignCanvasAction } from "../app/actions";
import { useToast } from "./ToastHost";
import { DesignAssetGlyph, DesignAssetPalette } from "./studio";
import s from "./designStudio.module.css";

export type CanvasStrokeClient = {
  id: string;
  points: StrokePointPct[];
  color: string;
  width_px: number;
};

type StudioMode = "place" | "draw";

function newId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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

type Props = {
  projectId: string;
  aerialUri: string;
  symbols: CatalogSymbol[];
  initialPlacements: CatalogPlacement[];
  initialStrokes: CanvasStrokeClient[];
};

export function DesignStudio({
  projectId,
  aerialUri,
  symbols,
  initialPlacements,
  initialStrokes,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<StudioMode>("place");
  const [placements, setPlacements] =
    useState<CatalogPlacement[]>(initialPlacements);
  const [strokes, setStrokes] = useState<CanvasStrokeClient[]>(initialStrokes);
  const [draftPoints, setDraftPoints] = useState<StrokePointPct[]>([]);
  const [dragSymbolId, setDragSymbolId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 280 });
  const drawingRef = useRef(false);

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

  const symbolById = new Map(symbols.map((sym) => [sym.id, sym]));

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

  function placeOnCanvas(clientX: number, clientY: number) {
    const el = canvasRef.current;
    if (!el || mode !== "place") return;
    const symbolId = dragSymbolId ?? selectedId;
    if (!symbolId) return;
    const rect = el.getBoundingClientRect();
    const pt = clientPct(clientX, clientY, rect);
    addPlacement(symbolId, pt.x_pct, pt.y_pct);
    setDragSymbolId(null);
  }

  function commitDraftStroke() {
    if (draftPoints.length < 2) {
      setDraftPoints([]);
      return;
    }
    setStrokes((prev) => [
      ...prev,
      {
        id: newId(),
        points: draftPoints,
        color: "#ff2ef6",
        width_px: 2,
      },
    ]);
    setDraftPoints([]);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (mode !== "draw") return;
    const el = canvasRef.current;
    if (!el) return;
    drawingRef.current = true;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    setDraftPoints([clientPct(e.clientX, e.clientY, rect)]);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drawingRef.current || mode !== "draw") return;
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
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const el = canvasRef.current;
    if (el?.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
    commitDraftStroke();
  }

  function undo() {
    if (draftPoints.length > 0) {
      setDraftPoints([]);
      return;
    }
    setStrokes((prev) => prev.slice(0, -1));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveDesignCanvasAction(projectId, placements, strokes);
      toast.show("Site plan saved", "success");
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
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

  return (
    <div className={s.root}>
      <div className={s.toolbar} role="toolbar" aria-label="Design tools">
        <div className={s.modeGroup}>
          <button
            type="button"
            className={`${s.modeBtn} ${mode === "place" ? s.modeBtnActive : ""}`}
            aria-pressed={mode === "place"}
            onClick={() => setMode("place")}
          >
            Place
          </button>
          <button
            type="button"
            className={`${s.modeBtn} ${mode === "draw" ? s.modeBtnActive : ""}`}
            aria-pressed={mode === "draw"}
            onClick={() => {
              setMode("draw");
              setSelectedId(null);
            }}
          >
            Draw
          </button>
        </div>
        <button type="button" className={s.toolBtn} onClick={undo}>
          Undo
        </button>
        <button
          type="button"
          className={s.toolBtn}
          onClick={() => setStrokes([])}
        >
          Clear markup
        </button>
        <button
          type="button"
          className={s.toolBtn}
          onClick={() => setPlacements([])}
        >
          Clear symbols
        </button>
        <span className={s.counts}>
          {placements.length} symbols · {strokes.length} strokes
        </span>
      </div>

      <div className={s.workspace}>
      <div className={s.canvasCol}>
      <p className={s.helper}>
        {mode === "place"
          ? "Pick an asset from the library, then click or drag onto the aerial."
          : "Markup with mouse, trackpad, or stylus — Curtis pink (OSS perfect-freehand)."}
      </p>

      <div
        ref={canvasRef}
        className={`${s.canvas} ${mode === "draw" ? s.canvasDraw : s.canvasPlace}`}
        onDragOver={(e) => {
          if (mode !== "place") return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          if (mode !== "place") return;
          e.preventDefault();
          placeOnCanvas(e.clientX, e.clientY);
        }}
        onClick={(e) => placeOnCanvas(e.clientX, e.clientY)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => mode === "draw" && e.preventDefault()}
        role="application"
        aria-label="Site plan canvas"
        data-testid="design-studio-canvas"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={aerialUri} alt="" className={s.aerial} draggable={false} />
        <svg
          className={s.strokeLayer}
          viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          {strokes.map((stroke) => (
            <path
              key={stroke.id}
              d={canvasStrokeToPathD(
                stroke,
                canvasSize.width,
                canvasSize.height,
              )}
              fill={stroke.color}
            />
          ))}
          {draftPath ? <path d={draftPath} fill="#ff2ef6" opacity={0.85} /> : null}
        </svg>
        {placements.map((p) => {
          const sym = symbolById.get(p.symbol_id);
          if (!sym) return null;
          return (
            <div
              key={p.id}
              className={s.placed}
              style={{ left: `${p.x_pct}%`, top: `${p.y_pct}%` }}
              data-testid="canvas-placement"
            >
              <DesignAssetGlyph symbol={sym} size="pin" />
            </div>
          );
        })}
      </div>

      <div className={s.actions}>
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

      <DesignAssetPalette
        symbols={symbols}
        selectedId={selectedId}
        disabled={mode === "draw"}
        onSelect={setSelectedId}
        onDragStart={setDragSymbolId}
        onDragEnd={() => setDragSymbolId(null)}
      />
      </div>
    </div>
  );
}
