"use client";

import { useCallback, useRef, useState } from "react";
import {
  buildOutsideDims,
  deleteVertex,
  edgeSegments,
  insertVertexAfter,
  polygonAreaM2,
  ptsAttr,
  snapAlignment,
  snapVertexDrag,
  tpzRadiusPct,
  type PctPoint,
} from "../../geometry";
import {
  formatCadAreaM2,
  formatCadBearing,
  formatCadMetres,
  neighbourLotContext,
  polygonCentroid,
} from "../../geometry/foundationCadContext";
import {
  BY_TYPE,
  type StudioItem,
  type StudioMode,
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
  frameOn: boolean;
  darkOn: boolean;
  /** Stage 1 — charcoal title overlay + AI underlay. */
  foundationCleanse?: boolean;
  /** Vicmap-sourced title — solid charcoal stroke (not dashed ghost). */
  titleLocked?: boolean;
  /** Title CAD nodes locked (no drag). */
  titleBoundaryLocked?: boolean;
  /** Optional cadastral lot area (Vicmap) for centre CAD label. */
  lotAreaM2?: number | null;
  /** Street / site label for CAD annotation (not REA map chrome). */
  siteLabel?: string | null;
  /** Vicmap / title metadata for CAD edge callouts. */
  titleMeta?: {
    parcelRef?: string | null;
    sourceLabel?: string | null;
    councilLabel?: string | null;
    sourceKind?: string | null;
  } | null;
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  tool: StudioTool;
  /** Studio mode — survey shows edge dims; sketch disables pointer capture. */
  mode?: StudioMode;
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
 * Plan drawing board — polys, symbols, edit handles, dims, TPZ.
 * Ground/aerial owned by AerialSlot + TactileGround (no plate/scrim here).
 */
export function CadPlanBoard({
  frameOn,
  darkOn,
  foundationCleanse = false,
  titleLocked = false,
  titleBoundaryLocked = false,
  lotAreaM2 = null,
  siteLabel = null,
  titleMeta = null,
  boundary,
  building,
  items,
  tool,
  mode = "cad",
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

  /** Title CAD drag when Stage 1 unlocked — snap via snapVertexDrag. */
  const titleEditing =
    foundationCleanse && !titleBoundaryLocked && !frameOn;
  const editing =
    (tool === "edit" && !locked && !frameOn && !foundationCleanse) ||
    (titleEditing && tool === "edit");
  const titleSolid = foundationCleanse || titleLocked;
  /** SDS — COLOR_VECTOR_PRIMARY charcoal when Vicmap/Stage 1; amber for dark. */
  const bStroke = titleSolid
    ? "#1C1917"
    : darkOn && !frameOn
      ? "#C99757"
      : "#1A1A1A";
  const bldStroke = darkOn && !frameOn ? "#F7F4EF" : "#1A1A1A";
  const bldFill =
    darkOn && !frameOn ? "rgba(247,244,239,0.35)" : "rgba(26,26,26,0.06)";

  /** Fit sheet working drawing: B + F. Stage 1 plate alone: B only. */
  const boundarySegs = edgeSegments(boundary, "B", scaleM);
  const buildingSegs = edgeSegments(building, "F", scaleM);
  const dimSegs = frameOn
    ? boundarySegs.concat(buildingSegs)
    : foundationCleanse
      ? boundarySegs
      : boundarySegs.concat(buildingSegs);
  const showDims =
    editing ||
    frameOn ||
    foundationCleanse ||
    titleLocked ||
    mode === "survey";
  const sketchPassthrough = mode === "sketch";
  /** Survey annotation tools own the pointer (prototype Level / Servc / Calib). */
  const surveyAnnotatePassthrough =
    mode === "survey" &&
    (tool === "calib" || tool === "level" || tool === "service");
  const boardPassthrough = sketchPassthrough || surveyAnnotatePassthrough;
  const cadTitleMode = foundationCleanse || titleLocked;
  /** Fit sheet: classic dashed boundary + solid footprint (screenshot language). */
  const fitSheetStroke = frameOn;
  const contextLots =
    cadTitleMode && !frameOn ? neighbourLotContext(boundary) : [];
  const titleCentroid = polygonCentroid(boundary);
  const drawnLotM2 = polygonAreaM2(boundary, scaleM);
  const areaLabelM2 =
    lotAreaM2 != null && lotAreaM2 > 5 ? lotAreaM2 : drawnLotM2;
  /** Compact offsets so Fit-sheet dims clear the title band / plot inset. */
  const outsideDims = frameOn
    ? [
        ...buildOutsideDims(boundarySegs, boundary, {
          offsetPct: 1.6,
          labelExtraPct: 1.0,
          tickPct: 0.9,
        }),
        ...(building.length >= 3
          ? buildOutsideDims(buildingSegs, building, {
              offsetPct: 1.2,
              labelExtraPct: 0.85,
              tickPct: 0.8,
            })
          : []),
      ]
    : [];

  const exist = items.find((i) => i.t === "exist" && !i.ghost);
  /** AI / design intelligence underlay — dimmed under CAD title in Stage 1. */
  const planItems = items;
  const underlayOp = foundationCleanse ? 0.38 : 1;
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
      const others = items
        .filter((o) => o.id !== d.id)
        .map((o) => ({ x: o.x, y: o.y }));
      const snapped = snapAlignment(p, others);
      setGuides({ x: snapped.guideX, y: snapped.guideY });
      onMoveItem(d.id, snapped.point.x, snapped.point.y);
      return;
    }
    if (
      (d.kind === "boundary" || d.kind === "building") &&
      d.index != null
    ) {
      const pts = d.kind === "boundary" ? boundary : building;
      const exclude = pts[d.index];
      const rect = rootRef.current?.getBoundingClientRect();
      const snapped = snapVertexDrag(p, [...boundary, ...building], {
        boardW: rect?.width ?? 960,
        boardH: rect?.height ?? 640,
        exclude,
        vertexPx: 12,
        shift: e.shiftKey,
      });
      const next = pts.map((pt, i) =>
        i === d.index ? { x: snapped.x, y: snapped.y } : pt,
      );
      if (d.kind === "boundary") onBoundaryChange(next);
      else onBuildingChange(next);
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
      data-mode={mode}
      data-cursor={editing ? cursorMode : "default"}
      style={boardPassthrough ? { pointerEvents: "none" } : undefined}
      onPointerDown={(e) => {
        if (boardPassthrough) return;
        if (nodeMenu) setNodeMenu(null);
        onPointerDownBoard(e);
      }}
      onPointerMove={boardPassthrough ? undefined : onPointerMove}
      onPointerUp={boardPassthrough ? undefined : onPointerUp}
    >
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
        {cadTitleMode
          ? contextLots.map((ring, i) => (
              <polygon
                key={`ctx${i}`}
                points={ptsAttr(ring)}
                className={css.cadContextLot}
                vectorEffect="non-scaling-stroke"
              />
            ))
          : null}
        <polygon
          points={ptsAttr(boundary)}
          fill={
            cadTitleMode && !fitSheetStroke
              ? "rgba(28, 25, 23, 0.045)"
              : "transparent"
          }
          stroke={fitSheetStroke ? "#1A1A1A" : bStroke}
          strokeWidth={1.5}
          strokeDasharray={
            fitSheetStroke || !titleSolid ? "4 4" : undefined
          }
          vectorEffect="non-scaling-stroke"
          opacity={layerOpacity.boundary}
          data-testid={
            titleSolid || fitSheetStroke
              ? "foundation-title-boundary"
              : undefined
          }
        />
        {building.length >= 3 ? (
          <polygon
            points={ptsAttr(building)}
            fill={bldFill}
            stroke={bldStroke}
            strokeWidth={foundationCleanse ? 1 : 1.5}
            vectorEffect="non-scaling-stroke"
            opacity={
              layerOpacity.boundary * (foundationCleanse ? underlayOp : 1)
            }
          />
        ) : null}
        {outsideDims.map((d) => (
          <g key={`odim${d.key}`} data-testid="outside-dim">
            <line
              x1={d.extA.x1}
              y1={d.extA.y1}
              x2={d.extA.x2}
              y2={d.extA.y2}
              stroke="#1A1A1A"
              strokeWidth={0.55}
              vectorEffect="non-scaling-stroke"
              data-testid="outside-dim-ext"
            />
            <line
              x1={d.extB.x1}
              y1={d.extB.y1}
              x2={d.extB.x2}
              y2={d.extB.y2}
              stroke="#1A1A1A"
              strokeWidth={0.55}
              vectorEffect="non-scaling-stroke"
              data-testid="outside-dim-ext"
            />
            <line
              x1={d.x1}
              y1={d.y1}
              x2={d.x2}
              y2={d.y2}
              stroke="#1A1A1A"
              strokeWidth={0.85}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={d.tickA.x1}
              y1={d.tickA.y1}
              x2={d.tickA.x2}
              y2={d.tickA.y2}
              stroke="#1A1A1A"
              strokeWidth={0.85}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={d.tickB.x1}
              y1={d.tickB.y1}
              x2={d.tickB.x2}
              y2={d.tickB.y2}
              stroke="#1A1A1A"
              strokeWidth={0.85}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
        {cadTitleMode && !frameOn
          ? dimSegs.map((d) => {
              const nx = -(d.b.y - d.a.y);
              const ny = d.b.x - d.a.x;
              const len = Math.hypot(nx, ny) || 1;
              const ox = (nx / len) * 1.1;
              const oy = (ny / len) * 1.1;
              return (
                <line
                  key={`dext${d.key}`}
                  x1={d.mid.x - ox}
                  y1={d.mid.y - oy}
                  x2={d.mid.x + ox}
                  y2={d.mid.y + oy}
                  stroke="#1C1917"
                  strokeWidth={0.9}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })
          : null}
        {setbackOn && !foundationCleanse ? (
          <polygon
            points={ptsAttr(
              boundary.map((p) => ({
                x: 50 + (p.x - 50) * 0.92,
                y: 50 + (p.y - 50) * 0.92,
              })),
            )}
            fill="none"
            stroke="#C99757"
            strokeWidth={1}
            strokeDasharray="4 4"
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
            fill="rgba(201,151,87,0.06)"
            stroke="#8C8A85"
            strokeWidth={1}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
            opacity={layerOpacity.council * underlayOp}
            data-tpz-state="normal"
          />
        ) : null}
      </svg>

      {editing
        ? boundary.map((p, i) => (
            <button
              key={`bh${i}`}
              type="button"
              className={`${css.cornerNode}${foundationCleanse ? ` ${css.cadCorner}` : ""}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              title={
                foundationCleanse
                  ? "Drag title node (vertex / ortho snap)"
                  : "Corner vertex"
              }
              aria-label={`Boundary corner ${i + 1}`}
              data-testid="cad-title-node"
              onPointerEnter={() => setCursorMode("move")}
              onPointerLeave={() => setCursorMode("default")}
              onPointerDown={(e) => startCornerDrag("boundary", i, e)}
              onContextMenu={(e) => {
                if (foundationCleanse) return;
                openNodeMenu("boundary", i, e);
              }}
            />
          ))
        : null}
      {editing && !foundationCleanse
        ? building.map((p, i) => (
            <button
              key={`fh${i}`}
              type="button"
              className={`${css.cornerNode} ${css.cornerNodeBuilding}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              title="Corner vertex"
              aria-label={`Footprint corner ${i + 1}`}
              onPointerEnter={() => setCursorMode("move")}
              onPointerLeave={() => setCursorMode("default")}
              onPointerDown={(e) => startCornerDrag("building", i, e)}
              onContextMenu={(e) => openNodeMenu("building", i, e)}
            />
          ))
        : null}

      {editing && !foundationCleanse
        ? midHandles(boundary, "boundary").map((m) => (
            <div
              key={`mb${m.after}`}
              className={css.midHandle}
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
              title="Split segment"
              onPointerEnter={() => setCursorMode("add")}
              onPointerLeave={() => setCursorMode("default")}
              onPointerDown={(e) => {
                e.stopPropagation();
                insertMid("boundary", m.after);
              }}
            />
          ))
        : null}
      {editing && !foundationCleanse
        ? midHandles(building, "building").map((m) => (
            <div
              key={`mf${m.after}`}
              className={`${css.midHandle} ${css.midHandleBuilding}`}
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
              title="Split segment"
              onPointerEnter={() => setCursorMode("add")}
              onPointerLeave={() => setCursorMode("default")}
              onPointerDown={(e) => {
                e.stopPropagation();
                insertMid("building", m.after);
              }}
            />
          ))
        : null}

      {/* Ticks only when locked (nodes are the edit affordance — never both). */}
      {titleSolid && !editing
        ? boundary.map((p, i) => (
            <span
              key={`ftick${i}`}
              className={css.foundationVertexTick}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              aria-hidden
              data-testid="foundation-vertex-tick"
            />
          ))
        : null}

      {showDims &&
        !frameOn &&
        dimSegs.map((d) => (
          <div
            key={d.key}
            className={`${css.dimMark}${cadTitleMode ? ` ${css.cadDimMark}` : ""}`}
            style={{
              left: `${d.mid.x}%`,
              top: `${d.mid.y}%`,
              transform: `translate(-50%, -50%) rotate(${d.rotDeg}deg)`,
            }}
          >
            <span className={css.obliqueTick} aria-hidden />
            <span
              className={cadTitleMode ? css.cadDimLabel : css.dimLabel}
              data-testid={cadTitleMode ? "cad-edge-dim" : undefined}
              title={
                cadTitleMode
                  ? `${d.key} · ${formatCadMetres(d.lengthM)} · ${formatCadBearing(d.rotDeg)}${
                      titleMeta?.parcelRef ? ` · ${titleMeta.parcelRef}` : ""
                    }`
                  : undefined
              }
            >
              {cadTitleMode ? (
                <>
                  <span className={css.cadDimKey}>{d.key}</span>
                  <span>{formatCadMetres(d.lengthM)}</span>
                  <span className={css.cadDimBearing}>
                    {formatCadBearing(d.rotDeg)}
                  </span>
                </>
              ) : (
                `${d.key} · ${d.lengthM.toFixed(2)} m`
              )}
            </span>
          </div>
        ))}

      {frameOn &&
        outsideDims.map((d) => (
          <div
            key={`olab${d.key}`}
            className={`${css.dimMark} ${css.fitOutsideDim}`}
            style={{
              left: `${d.labelX}%`,
              top: `${d.labelY}%`,
              transform: `translate(-50%, -50%) rotate(${d.rotDeg}deg)`,
            }}
            data-testid="fit-outside-dim-label"
          >
            <span className={css.obliqueTick} aria-hidden />
            <span className={css.fitDimLabel}>
              {d.key} · {d.lengthM.toFixed(2)} m
            </span>
          </div>
        ))}

      {cadTitleMode && !frameOn && boundary.length >= 3 ? (
        <div
          className={css.cadAreaLabel}
          style={{ left: `${titleCentroid.x}%`, top: `${titleCentroid.y}%` }}
          data-testid="cad-title-area"
        >
          <span className={css.cadAreaValue}>{formatCadAreaM2(areaLabelM2)}</span>
          <span className={css.cadAreaMeta}>
            {titleMeta?.parcelRef
              ? titleMeta.parcelRef
              : titleMeta?.sourceLabel ?? "title area"}
          </span>
          {titleMeta?.councilLabel ? (
            <span className={css.cadAreaMeta}>{titleMeta.councilLabel}</span>
          ) : null}
          <span className={css.cadLockState}>
            {titleBoundaryLocked ? "LOCKED" : "UNLOCKED · drag nodes"}
          </span>
        </div>
      ) : null}

      {cadTitleMode && !frameOn && siteLabel ? (
        <p className={css.cadStreetCue} data-testid="cad-street-cue">
          {siteLabel}
        </p>
      ) : null}

      {exist && tpz && !foundationCleanse ? (
        <div
          className={css.tpzTag}
          style={{ left: `${exist.x + tpz.rxPct * 0.55}%`, top: `${exist.y}%` }}
        >
          TPZ Ø{tpz.radiusM.toFixed(1)} m — AS 4970
        </div>
      ) : null}

      {planItems.map((it) => {
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
            className={`${css.item}${it.ghost && it.stale ? ` ${css.stalePulse}` : ""}${flagged ? ` ${css.flagged}` : ""}${foundationCleanse ? ` ${css.itemUnderlay}` : ""}`}
            style={{
              left: `${it.x}%`,
              top: `${it.y}%`,
              width: w,
              height: h,
              borderRadius: d.br,
              opacity: (it.ghost ? 0.45 : 1) * bucketOp * underlayOp,
              pointerEvents: foundationCleanse ? "none" : undefined,
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

    </div>
  );
}
