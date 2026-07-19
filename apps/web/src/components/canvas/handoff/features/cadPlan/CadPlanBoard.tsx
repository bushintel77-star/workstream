"use client";

import { useCallback, useRef } from "react";
import {
  edgeSegments,
  ptsAttr,
  tpzRadiusPct,
  type PctPoint,
} from "../../geometry";
import {
  BY_TYPE,
  type StudioItem,
  type StudioTool,
} from "../../studioCatalog";
import { StudioGlyph } from "../../StudioGlyph";
import { ITEM_LAYER, type LayerOpacity } from "../../state/studioTypes";
import css from "./cadPlan.module.css";

type Props = {
  aerialUri: string | null;
  frameOn: boolean;
  darkOn: boolean;
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  tool: StudioTool;
  locked: boolean;
  layerOpacity: LayerOpacity;
  setbackOn: boolean;
  growth: "plant" | "5yr" | "mature";
  selectedId: string | null;
  hoverId: string | null;
  curGhostId: string | null;
  scaleM?: number;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onAcceptGhost: (id: string) => void;
  onRejectGhost: (id: string) => void;
  onTraceInElevation: (id: string) => void;
  onBoundaryChange: (pts: PctPoint[]) => void;
  onBuildingChange: (pts: PctPoint[]) => void;
  onPlace: (x: number, y: number) => void;
  onMoveItem: (id: string, x: number, y: number) => void;
};

function growthFactor(stage: "plant" | "5yr" | "mature", existing: boolean) {
  if (existing) return 1;
  if (stage === "plant") return 0.45;
  if (stage === "5yr") return 0.75;
  return 1;
}

/**
 * Plan drawing board — aerial, polys, symbols, edit handles, dims, TPZ.
 */
export function CadPlanBoard({
  aerialUri,
  frameOn,
  darkOn,
  boundary,
  building,
  items,
  tool,
  locked,
  layerOpacity,
  setbackOn,
  growth,
  selectedId,
  hoverId,
  curGhostId,
  scaleM = 110,
  onSelect,
  onHover,
  onAcceptGhost,
  onRejectGhost,
  onTraceInElevation,
  onBoundaryChange,
  onBuildingChange,
  onPlace,
  onMoveItem,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: "item" | "boundary" | "building";
    id?: string;
    index?: number;
    ox: number;
    oy: number;
  } | null>(null);

  const editing = tool === "edit" && !locked && !frameOn;
  const bStroke = darkOn && !frameOn ? "#E8B84B" : "#241318";
  const bldStroke = darkOn && !frameOn ? "#F6EAED" : "#241318";
  const bldFill =
    darkOn && !frameOn ? "rgba(246,234,237,0.4)" : "rgba(36,19,24,0.07)";

  const dimSegs = edgeSegments(boundary, "B", scaleM).concat(
    edgeSegments(building, "F", scaleM),
  );

  const exist = items.find((i) => i.t === "exist" && !i.ghost);
  const tpz = exist
    ? tpzRadiusPct(BY_TYPE.exist.dbhM ?? 0.45, scaleM)
    : null;

  const toPct = useCallback((clientX: number, clientY: number) => {
    const el = rootRef.current;
    if (!el) return { x: 50, y: 50 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100)),
    };
  }, []);

  const onPointerDownBoard = (e: React.PointerEvent) => {
    if (tool === "add") {
      const p = toPct(e.clientX, e.clientY);
      onPlace(p.x, p.y);
    }
  };

  const startCornerDrag = (
    kind: "boundary" | "building",
    index: number,
    e: React.PointerEvent,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { kind, index, ox: 0, oy: 0 };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toPct(e.clientX, e.clientY);
    if (d.kind === "item" && d.id) {
      onMoveItem(d.id, p.x, p.y);
      return;
    }
    if (d.kind === "boundary" && d.index != null) {
      const next = boundary.map((pt, i) => (i === d.index ? p : pt));
      onBoundaryChange(next);
    }
    if (d.kind === "building" && d.index != null) {
      const next = building.map((pt, i) => (i === d.index ? p : pt));
      onBuildingChange(next);
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const midHandles = (pts: PctPoint[], kind: "boundary" | "building") =>
    pts.map((a, i) => {
      const b = pts[(i + 1) % pts.length]!;
      return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        kind,
        after: i,
      };
    });

  const insertMid = (kind: "boundary" | "building", after: number) => {
    const pts = kind === "boundary" ? boundary : building;
    const a = pts[after]!;
    const b = pts[(after + 1) % pts.length]!;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const next = [...pts.slice(0, after + 1), mid, ...pts.slice(after + 1)];
    if (kind === "boundary") onBoundaryChange(next);
    else onBuildingChange(next);
  };

  return (
    <div
      ref={rootRef}
      className={css.world}
      data-testid="cad-plan-board"
      onPointerDown={onPointerDownBoard}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className={css.aerial}
        style={
          aerialUri && !frameOn
            ? { backgroundImage: `url(${aerialUri})` }
            : frameOn
              ? { background: "#faf6f2" }
              : undefined
        }
      >
        {!aerialUri && !frameOn ? (
          <div className={css.aerialEmpty}>
            Drop Mapbox aerial screenshot here (2D top-down)
            <br />
            or browse files
          </div>
        ) : null}
      </div>
      {!frameOn ? (
        <div className={`${css.scrim}${darkOn ? ` ${css.scrimDark}` : ""}`} />
      ) : null}

      <svg className={css.planSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon
          points={ptsAttr(boundary)}
          fill="transparent"
          stroke={bStroke}
          strokeWidth={2}
          strokeDasharray="6 3"
          vectorEffect="non-scaling-stroke"
          opacity={layerOpacity.boundary}
        />
        <polygon
          points={ptsAttr(building)}
          fill={bldFill}
          stroke={bldStroke}
          strokeWidth={1.6}
          vectorEffect="non-scaling-stroke"
          opacity={layerOpacity.boundary}
        />
        {setbackOn ? (
          <polygon
            points={ptsAttr(
              boundary.map((p) => ({
                x: 50 + (p.x - 50) * 0.92,
                y: 50 + (p.y - 50) * 0.92,
              })),
            )}
            fill="none"
            stroke="#C2455F"
            strokeWidth={1.2}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
            opacity={0.9 * layerOpacity.council}
          />
        ) : null}
        {exist && tpz ? (
          <ellipse
            cx={exist.x}
            cy={exist.y}
            rx={tpz.rxPct}
            ry={tpz.rxPct * 0.75}
            fill="rgba(232,184,75,0.08)"
            stroke="#B78A2E"
            strokeWidth={1.2}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
            opacity={layerOpacity.council}
          />
        ) : null}

        {editing
          ? boundary.map((p, i) => (
              <g key={`bh${i}`}>
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={p.x}
                  y2={p.y}
                  stroke="#E8B84B"
                  strokeWidth={15}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className={css.handleHit}
                  onPointerDown={(e) => startCornerDrag("boundary", i, e)}
                />
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={p.x}
                  y2={p.y}
                  stroke="#FFF6F8"
                  strokeWidth={6}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))
          : null}
        {editing
          ? building.map((p, i) => (
              <g key={`fh${i}`}>
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={p.x}
                  y2={p.y}
                  stroke="#B08A95"
                  strokeWidth={13}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className={css.handleHit}
                  onPointerDown={(e) => startCornerDrag("building", i, e)}
                />
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={p.x}
                  y2={p.y}
                  stroke="#FFF6F8"
                  strokeWidth={5}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))
          : null}
      </svg>

      {editing
        ? midHandles(boundary, "boundary").map((m) => (
            <div
              key={`mb${m.after}`}
              className={css.midHandle}
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
              title="Drag to add a corner"
              onPointerDown={(e) => {
                e.stopPropagation();
                insertMid("boundary", m.after);
              }}
            />
          ))
        : null}

      {(editing || frameOn) &&
        dimSegs.map((d) => (
          <div
            key={d.key}
            className={css.dimLabel}
            style={{
              left: `${d.mid.x}%`,
              top: `${d.mid.y}%`,
              transform: `translate(-50%, -50%) rotate(${d.rotDeg}deg)`,
            }}
          >
            {d.lengthM.toFixed(1)} m
          </div>
        ))}

      {exist && tpz ? (
        <div
          className={css.tpzTag}
          style={{ left: `${exist.x + tpz.rxPct * 0.55}%`, top: `${exist.y}%` }}
        >
          TPZ Ø{tpz.radiusM.toFixed(1)} m — AS 4970
        </div>
      ) : null}

      {items.map((it) => {
        const d = BY_TYPE[it.t];
        const gk = growthFactor(growth, !!d.existing);
        const w = Math.round(d.w * it.scale * gk);
        const h = Math.round(d.h * it.scale * gk);
        const bucket = ITEM_LAYER[it.t];
        const bucketOp = layerOpacity[bucket] ?? 1;
        const isCur = it.id === curGhostId;
        const selected = it.id === selectedId;
        const hovered = it.id === hoverId;
        return (
          <div
            key={it.id}
            className={`${css.item}${it.ghost && it.stale ? ` ${css.stalePulse}` : ""}`}
            style={{
              left: `${it.x}%`,
              top: `${it.y}%`,
              width: w,
              height: h,
              borderRadius: d.br,
              opacity: (it.ghost ? 0.5 : 1) * bucketOp,
              transform: `translate(-50%, -50%) rotate(${it.rot}deg)`,
              border: it.ghost
                ? isCur
                  ? "2px solid #C2455F"
                  : it.stale
                    ? "1.5px dashed #B78A2E"
                    : "1.5px dashed rgba(232,184,75,0.9)"
                : "none",
              boxShadow: selected
                ? "0 0 0 2px rgba(255,246,248,0.95), 0 0 0 4px #C2455F"
                : isCur
                  ? "0 0 0 3px rgba(194,69,95,0.3)"
                  : hovered && !it.ghost
                    ? "0 0 0 2px rgba(255,246,248,0.85), 0 0 0 3.5px rgba(194,69,95,0.4)"
                    : "none",
              zIndex: isCur ? 50 : selected ? 20 : hovered ? 10 : 2,
            }}
            title={
              it.stale
                ? `${it.why ?? d.name} · nearby edit — recheck this`
                : (it.why ?? d.name)
            }
            onPointerEnter={() => onHover(it.id)}
            onPointerLeave={() => onHover(null)}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(it.id);
              if (!it.ghost && tool !== "lock") {
                dragRef.current = { kind: "item", id: it.id, ox: 0, oy: 0 };
                (e.target as Element).setPointerCapture?.(e.pointerId);
              }
            }}
          >
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <StudioGlyph type={it.t} ink={!darkOn || frameOn} />
            </div>
            {it.ghost ? <span className={css.aiChip}>AI</span> : null}
            {isCur && !frameOn ? (
              <div
                className={css.ghostActions}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className={css.acceptBtn}
                  onClick={() => onAcceptGhost(it.id)}
                >
                  ✓ Accept
                </button>
                <button
                  type="button"
                  className={css.rejectBtn}
                  title="Reject suggestion"
                  onClick={() => onRejectGhost(it.id)}
                >
                  ✕
                </button>
              </div>
            ) : null}
            {selected && !it.ghost && d.heightM && !frameOn ? (
              <button
                type="button"
                className={css.tracePill}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onTraceInElevation(it.id)}
              >
                ⇄ Trace in elevation
              </button>
            ) : null}
          </div>
        );
      })}

      {editing ? (
        <div className={css.editBanner}>
          Edit corners — drag ● move · drag ◆ add · right-click ● delete
        </div>
      ) : null}

      <div className={css.north}>N↑</div>
    </div>
  );
}
