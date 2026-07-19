"use client";

import { useCallback, useRef, useState } from "react";
import {
  deleteVertex,
  edgeSegments,
  insertVertexAfter,
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
import { SelectionHandles } from "./SelectionHandles";
import css from "./cadPlan.module.css";

type NodeMenu = {
  kind: "boundary" | "building";
  index: number;
  x: number;
  y: number;
};

type Props = {
  aerialUri: string | null;
  /** When true, aerial is rendered by AerialSlot outside this board. */
  externalAerial?: boolean;
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
  groupIds: string[];
  hoverId: string | null;
  curGhostId: string | null;
  /** Item ids currently failing preemptive council checks. */
  flaggedIds?: Set<string>;
  /** Live TPZ encroachment labels (calm compliance — inline, not modal). */
  tpzReadouts?: Array<{
    id: string;
    x: number;
    y: number;
    pct: number;
    active: boolean;
  }>;
  scaleM?: number;
  onSelect: (id: string | null, opts?: { additive?: boolean }) => void;
  onMarqueeSelect: (ids: string[]) => void;
  onHover: (id: string | null) => void;
  onAcceptGhost: (id: string) => void;
  onRejectGhost: (id: string) => void;
  onTraceInElevation: (id: string) => void;
  onBoundaryChange: (pts: PctPoint[]) => void;
  onBuildingChange: (pts: PctPoint[]) => void;
  onPlace: (x: number, y: number) => void;
  onMoveItem: (id: string, x: number, y: number) => void;
  onMoveGroup: (ids: string[], dx: number, dy: number) => void;
  onTransformItem: (
    id: string,
    patch: Partial<Pick<StudioItem, "rot" | "scale">>,
  ) => void;
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
  externalAerial = false,
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
  groupIds,
  hoverId,
  curGhostId,
  flaggedIds,
  tpzReadouts,
  scaleM = 110,
  onSelect,
  onMarqueeSelect,
  onHover,
  onAcceptGhost,
  onRejectGhost,
  onTraceInElevation,
  onBoundaryChange,
  onBuildingChange,
  onPlace,
  onMoveItem,
  onMoveGroup,
  onTransformItem,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: "item" | "boundary" | "building" | "marquee" | "group";
    id?: string;
    index?: number;
    ox?: number;
    oy?: number;
    ids?: string[];
    startX?: number;
    startY?: number;
  } | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });
  const [marquee, setMarquee] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [nodeMenu, setNodeMenu] = useState<NodeMenu | null>(null);
  const [cursorMode, setCursorMode] = useState<"default" | "move" | "add">(
    "default",
  );

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
      return;
    }
    if (tool === "edit" || tool === "pan") {
      const p = toPct(e.clientX, e.clientY);
      dragRef.current = {
        kind: "marquee",
        startX: p.x,
        startY: p.y,
        ox: p.x,
        oy: p.y,
      };
      setMarquee({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
  };

  const startCornerDrag = (
    kind: "boundary" | "building",
    index: number,
    e: React.PointerEvent,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setNodeMenu(null);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { kind, index, ox: 0, oy: 0 };
  };

  const openNodeMenu = (
    kind: "boundary" | "building",
    index: number,
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const pts = kind === "boundary" ? boundary : building;
    const p = pts[index];
    if (!p) return;
    setNodeMenu({ kind, index, x: p.x, y: p.y });
  };

  const removeNode = (kind: "boundary" | "building", index: number) => {
    const pts = kind === "boundary" ? boundary : building;
    const next = deleteVertex(pts, index);
    if (!next) return;
    if (kind === "boundary") onBoundaryChange(next);
    else onBuildingChange(next);
    setNodeMenu(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toPct(e.clientX, e.clientY);
    if (d.kind === "marquee" && d.startX != null && d.startY != null) {
      setMarquee({ x1: d.startX, y1: d.startY, x2: p.x, y2: p.y });
      return;
    }
    if (d.kind === "group" && d.ids && d.startX != null && d.startY != null) {
      const dx = p.x - d.startX;
      const dy = p.y - d.startY;
      dragRef.current = { ...d, startX: p.x, startY: p.y };
      onMoveGroup(d.ids, dx, dy);
      return;
    }
    if (d.kind === "item" && d.id) {
      const thresh = 1.3;
      let gx: number | null = null;
      let gy: number | null = null;
      for (const o of items) {
        if (o.id === d.id) continue;
        if (gx == null && Math.abs(o.x - p.x) < thresh) gx = o.x;
        if (gy == null && Math.abs(o.y - p.y) < thresh) gy = o.y;
      }
      setGuides({ x: gx, y: gy });
      onMoveItem(d.id, gx ?? p.x, gy ?? p.y);
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
    const d = dragRef.current;
    if (d?.kind === "marquee" && marquee) {
      const minX = Math.min(marquee.x1, marquee.x2);
      const maxX = Math.max(marquee.x1, marquee.x2);
      const minY = Math.min(marquee.y1, marquee.y2);
      const maxY = Math.max(marquee.y1, marquee.y2);
      const area = (maxX - minX) * (maxY - minY);
      if (area > 1.5) {
        const hit = items
          .filter(
            (i) =>
              !i.ghost &&
              i.x >= minX &&
              i.x <= maxX &&
              i.y >= minY &&
              i.y <= maxY,
          )
          .map((i) => i.id);
        onMarqueeSelect(hit);
      } else {
        onSelect(null);
      }
    }
    dragRef.current = null;
    setMarquee(null);
    setGuides({ x: null, y: null });
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
    const next = insertVertexAfter(pts, after);
    if (kind === "boundary") onBoundaryChange(next);
    else onBuildingChange(next);
    setNodeMenu(null);
  };

  const selected = items.find((i) => i.id === selectedId && !i.ghost) ?? null;

  return (
    <div
      ref={rootRef}
      className={`${css.world}${editing ? ` ${css.worldEdit}` : ""}`}
      data-testid="cad-plan-board"
      data-cad-plan
      data-cursor={editing ? cursorMode : "default"}
      onPointerDown={(e) => {
        if (nodeMenu) setNodeMenu(null);
        onPointerDownBoard(e);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {externalAerial ? (
        <div
          className={css.aerial}
          style={
            frameOn
              ? { background: "#faf6f2" }
              : { background: "transparent", backgroundImage: "none" }
          }
          aria-hidden
        />
      ) : (
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
      )}
      {!frameOn ? (
        <div className={`${css.scrim}${darkOn ? ` ${css.scrimDark}` : ""}`} />
      ) : null}

      <svg className={css.planSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <pattern
            id="ws-hardscape-hatch"
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="4"
              stroke="rgba(194,69,95,0.55)"
              strokeWidth="1.2"
            />
          </pattern>
        </defs>
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
                  onPointerEnter={() => setCursorMode("move")}
                  onPointerLeave={() => setCursorMode("default")}
                  onPointerDown={(e) => startCornerDrag("boundary", i, e)}
                  onContextMenu={(e) => openNodeMenu("boundary", i, e)}
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
                  onPointerEnter={() => setCursorMode("move")}
                  onPointerLeave={() => setCursorMode("default")}
                  onPointerDown={(e) => startCornerDrag("building", i, e)}
                  onContextMenu={(e) => openNodeMenu("building", i, e)}
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
              title="Add vertex"
              onPointerEnter={() => setCursorMode("add")}
              onPointerLeave={() => setCursorMode("default")}
              onPointerDown={(e) => {
                e.stopPropagation();
                insertMid("boundary", m.after);
              }}
            />
          ))
        : null}
      {editing
        ? midHandles(building, "building").map((m) => (
            <div
              key={`mf${m.after}`}
              className={`${css.midHandle} ${css.midHandleBuilding}`}
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
              title="Add vertex"
              onPointerEnter={() => setCursorMode("add")}
              onPointerLeave={() => setCursorMode("default")}
              onPointerDown={(e) => {
                e.stopPropagation();
                insertMid("building", m.after);
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
        const flagged = flaggedIds?.has(it.id) && !it.ghost;
        return (
          <div
            key={it.id}
            className={`${css.item}${it.ghost && it.stale ? ` ${css.stalePulse}` : ""}${flagged ? ` ${css.flagged}` : ""}`}
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
                : flagged
                  ? "2px solid #C2455F"
                  : "none",
              boxShadow:
                selected || groupIds.includes(it.id)
                  ? "0 0 0 2px rgba(255,246,248,0.95), 0 0 0 4px #C2455F"
                  : isCur
                    ? "0 0 0 3px rgba(194,69,95,0.3)"
                    : flagged
                      ? "0 0 0 3px rgba(194,69,95,0.35)"
                      : hovered && !it.ghost
                        ? "0 0 0 2px rgba(255,246,248,0.85), 0 0 0 3.5px rgba(194,69,95,0.4)"
                        : "none",
              zIndex: isCur
                ? 50
                : selected || groupIds.includes(it.id)
                  ? 20
                  : hovered
                    ? 10
                    : 2,
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
              const additive = e.shiftKey || e.metaKey;
              onSelect(it.id, { additive });
              if (!it.ghost && tool !== "lock") {
                const ids =
                  groupIds.includes(it.id) && groupIds.length > 1
                    ? groupIds
                    : [it.id];
                if (ids.length > 1) {
                  const p = toPct(e.clientX, e.clientY);
                  dragRef.current = {
                    kind: "group",
                    ids,
                    startX: p.x,
                    startY: p.y,
                  };
                } else {
                  dragRef.current = { kind: "item", id: it.id, ox: 0, oy: 0 };
                }
                (e.target as Element).setPointerCapture?.(e.pointerId);
              }
            }}
          >
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <StudioGlyph type={it.t} ink={!darkOn || frameOn} />
            </div>
            {flagged && (it.t === "paving" || it.t === "deck") ? (
              <div className={css.hatchOverlay} aria-hidden />
            ) : null}
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

      {marquee ? (
        <div
          className={css.marquee}
          style={{
            left: `${Math.min(marquee.x1, marquee.x2)}%`,
            top: `${Math.min(marquee.y1, marquee.y2)}%`,
            width: `${Math.abs(marquee.x2 - marquee.x1)}%`,
            height: `${Math.abs(marquee.y2 - marquee.y1)}%`,
          }}
        />
      ) : null}

      {guides.x != null ? (
        <div className={css.guideV} style={{ left: `${guides.x}%` }} />
      ) : null}
      {guides.y != null ? (
        <div className={css.guideH} style={{ top: `${guides.y}%` }} />
      ) : null}

      {selected && !frameOn && tool !== "lock" ? (
        <SelectionHandles
          item={selected}
          boardW={rootRef.current?.clientWidth ?? 960}
          boardH={rootRef.current?.clientHeight ?? 640}
          onTransform={onTransformItem}
        />
      ) : null}

      {tpzReadouts?.map((r) =>
        r.active ? (
          <div
            key={r.id}
            className={css.tpzReadout}
            data-testid="tpz-encroach-readout"
            style={{ left: `${r.x}%`, top: `${r.y}%` }}
          >
            TPZ {Math.round(r.pct)}%
          </div>
        ) : null,
      )}

      {editing ? (
        <div className={css.editBanner} data-testid="edit-vector-banner">
          Hover node to move · hover edge diamond to add · right-click node to
          delete
        </div>
      ) : null}

      {nodeMenu ? (
        <div
          className={css.nodeMenu}
          data-testid="vector-node-menu"
          style={{ left: `${nodeMenu.x}%`, top: `${nodeMenu.y}%` }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={css.nodeMenuBtn}
            disabled={
              (nodeMenu.kind === "boundary"
                ? boundary.length
                : building.length) <= 3
            }
            onClick={() => removeNode(nodeMenu.kind, nodeMenu.index)}
          >
            Delete node
          </button>
          <button
            type="button"
            className={css.nodeMenuBtn}
            onClick={() => insertMid(nodeMenu.kind, nodeMenu.index)}
          >
            Add node after
          </button>
          <button
            type="button"
            className={css.nodeMenuBtn}
            onClick={() => setNodeMenu(null)}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div className={css.north}>N↑</div>
    </div>
  );
}
