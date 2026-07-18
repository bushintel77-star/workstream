"use client";

import { useMemo, useRef, useState } from "react";
import {
  deleteBoundaryVertex,
  geoToCanvasMetres,
  insertBoundaryVertex,
  moveBoundaryVertex,
} from "@workstream/domain";
import type { SiteBoundaryLite } from "../../lib/canvas-types";
import {
  percentToLngLat,
  projectLngLatToPercent,
  type StaticMapView,
} from "../../lib/mapView";
import css from "./boundaryLockSnap.module.css";

export type BoundaryTool = "pan" | "auto" | "edit" | "add";

type DomainBoundary = Parameters<typeof moveBoundaryVertex>[0];

type SharedProps = {
  boundary: SiteBoundaryLite | null;
  tool: BoundaryTool;
  pending: boolean;
  onChange: (next: SiteBoundaryLite) => void;
  onAutoTrace: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onReset: () => void;
  onToolChange: (tool: BoundaryTool) => void;
  /** When title is locked - open cream Fit sheet + CAD. */
  onOpenFitSheet?: () => void;
};

function toDomain(b: SiteBoundaryLite): DomainBoundary {
  return b as unknown as DomainBoundary;
}

function fromDomain(b: DomainBoundary): SiteBoundaryLite {
  return b as unknown as SiteBoundaryLite;
}

/** Fixed chrome — toolbar + status pill + telemetry (outside pan/zoom world). */
export function BoundaryChrome({
  boundary,
  tool,
  pending,
  onAutoTrace,
  onLock,
  onUnlock,
  onReset,
  onToolChange,
  onOpenFitSheet,
}: Omit<SharedProps, "onChange">) {
  const locked = boundary?.status === "VERIFIED";
  const editing = tool === "edit" || tool === "add";
  return (
    <>
      <div className={css.toolbar} role="toolbar" aria-label="Boundary tools">
        {locked ? (
          <>
            {onOpenFitSheet ? (
              <button
                type="button"
                className={`${css.tool} ${css.toolPrimary}`}
                title="Open cream Fit sheet + line CAD"
                data-testid="boundary-open-fit-sheet"
                onClick={onOpenFitSheet}
              >
                <span>Open Fit sheet</span>
              </button>
            ) : null}
            <button
              type="button"
              className={`${css.tool} ${css.toolLocked}`}
              title="Unlock title to edit vertices"
              disabled={pending || !boundary}
              onClick={onUnlock}
            >
              <span>Unlock</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`${css.tool} ${tool === "auto" ? css.toolActive : ""}`}
              title="AI Auto-Trace — Vicmap parcel when available"
              disabled={pending}
              onClick={() => {
                onToolChange("auto");
                onAutoTrace();
              }}
            >
              <span>Trace</span>
            </button>
            <button
              type="button"
              className={`${css.tool} ${tool === "edit" ? css.toolActive : ""}`}
              title="Edit nodes"
              disabled={pending || !boundary}
              onClick={() => onToolChange(editing ? "pan" : "edit")}
            >
              <span>{editing ? "Done" : "Edit boundary"}</span>
            </button>
            {editing ? (
              <>
                <button
                  type="button"
                  className={`${css.tool} ${tool === "add" ? css.toolActive : ""}`}
                  title="Add node"
                  disabled={pending || !boundary}
                  onClick={() => onToolChange("add")}
                >
                  <span>Add</span>
                </button>
                <button
                  type="button"
                  className={css.tool}
                  title="Reset vector"
                  disabled={pending || !boundary}
                  onClick={onReset}
                >
                  <span>Reset</span>
                </button>
              </>
            ) : null}
            <button
              type="button"
              className={css.tool}
              title="Lock Boundary (L)"
              disabled={pending || !boundary}
              onClick={onLock}
            >
              <span>Lock title</span>
            </button>
            <button
              type="button"
              className={`${css.tool} ${tool === "pan" ? css.toolActive : ""}`}
              title="Pan canvas"
              onClick={() => onToolChange("pan")}
            >
              <span>Pan</span>
            </button>
          </>
        )}
      </div>

      {boundary ? (
        <div className={css.hud}>
          <span
            className={`${css.pill} ${locked ? css.pillVerified : css.pillDraft}`}
          >
            {locked
              ? "TITLE LOCKED · FIT SHEET READY"
              : "TITLE UNVERIFIED · TRACE OR EDIT"}
          </span>
          <div className={css.telemetry}>
            <div>
              <em>Outdoor area</em>
              <strong>
                {boundary.calculated_metrics.total_area_m2.toLocaleString()} m²
              </strong>
            </div>
            <div>
              <em>Perimeter</em>
              <strong>
                {boundary.calculated_metrics.perimeter_m.toLocaleString()} lm
              </strong>
            </div>
            {!locked &&
            boundary.calculated_metrics.ai_confidence != null ? (
              <div>
                <em>AI confidence</em>
                <strong>
                  {Math.round(
                    boundary.calculated_metrics.ai_confidence * 100,
                  )}
                  %
                </strong>
              </div>
            ) : null}
            <div>
              <em>Source</em>
              <strong>{boundary.source_kind}</strong>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

type OverlayProps = Pick<SharedProps, "boundary" | "tool" | "onChange"> & {
  /** When set, vertices are projected into the aerial frame (relative %). */
  mapView?: StaticMapView | null;
};

/** Vector overlay — aerial-relative % when mapView is set, else lot metres. */
export function BoundaryOverlay({
  boundary,
  tool,
  onChange,
  mapView = null,
}: OverlayProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverSeg, setHoverSeg] = useState<{
    afterId: string;
    x: number;
    y: number;
  } | null>(null);
  const dragRef = useRef<{ id: string } | null>(null);

  const sorted = useMemo(() => {
    if (!boundary) return [];
    return boundary.vertices
      .slice()
      .sort((a, b) => a.sequence_index - b.sequence_index);
  }, [boundary]);

  const projected = useMemo(() => {
    if (!boundary || !mapView) return null;
    return sorted.map((v) => {
      const [x, y] = projectLngLatToPercent(
        v.geo_coords.lng,
        v.geo_coords.lat,
        mapView,
      );
      return { id: v.vertex_id, x, y, v };
    });
  }, [boundary, mapView, sorted]);

  if (!boundary) return null;

  const locked = boundary.status === "VERIFIED";
  const stroke = locked ? "#5ea884" : "#c9955a";
  const useAerial = Boolean(mapView && projected);
  const vbW = useAerial ? 100 : boundary.width_m;
  const vbH = useAerial ? 100 : boundary.height_m;
  const nodeR = Math.max(vbW, vbH) * (useAerial ? 0.014 : 0.014);

  const toCanvas = (sx: number, sy: number): { x: number; y: number } => {
    if (mapView) {
      const [lng, lat] = percentToLngLat(sx, sy, mapView);
      return geoToCanvasMetres(
        { lng, lat },
        boundary.geo_reference.canvas_origin_geo,
      );
    }
    return { x: sx, y: vbH - sy };
  };

  const screenOf = (v: (typeof sorted)[number]): { x: number; y: number } => {
    if (projected) {
      const hit = projected.find((p) => p.id === v.vertex_id);
      if (hit) return { x: hit.x, y: hit.y };
    }
    return {
      x: v.canvas_coords.x,
      y: boundary.height_m - v.canvas_coords.y,
    };
  };

  const pointsAttr = sorted
    .map((v) => {
      const p = screenOf(v);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  const onNodePointerDown = (
    e: React.PointerEvent,
    vertexId: string,
  ) => {
    if (locked || (tool !== "edit" && tool !== "add")) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { id: vertexId };
    setSelectedId(vertexId);
  };

  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || locked) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    const canvas = toCanvas(local.x, local.y);
    onChange(
      fromDomain(
        moveBoundaryVertex(toDomain(boundary), dragRef.current.id, canvas),
      ),
    );
  };

  const onSegmentClick = (
    e: React.MouseEvent,
    afterId: string,
    sx: number,
    sy: number,
  ) => {
    if (locked) return;
    if (tool !== "add" && tool !== "edit") return;
    e.stopPropagation();
    const canvas = toCanvas(sx, sy);
    onChange(
      fromDomain(insertBoundaryVertex(toDomain(boundary), afterId, canvas)),
    );
  };

  const onNodeContextMenu = (e: React.MouseEvent, vertexId: string) => {
    if (locked) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      onChange(fromDomain(deleteBoundaryVertex(toDomain(boundary), vertexId)));
      setSelectedId(null);
    } catch {
      /* keep min vertices */
    }
  };

  return (
    <svg
      className={css.overlay}
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio={useAerial ? "none" : "xMidYMid meet"}
      onPointerMove={onSvgPointerMove}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      style={{ pointerEvents: tool === "pan" ? "none" : "auto" }}
      data-boundary-space={useAerial ? "aerial" : "lot-metres"}
    >
      <polygon
        points={pointsAttr}
        className={locked ? css.polyLocked : css.polyDraft}
        stroke={stroke}
      />
      {sorted.map((v, i) => {
        const next = sorted[(i + 1) % sorted.length]!;
        const a = screenOf(v);
        const b = screenOf(next);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        return (
          <g key={`seg-${v.vertex_id}`}>
            {!locked && (tool === "add" || tool === "edit") ? (
              <circle
                cx={mx}
                cy={my}
                r={nodeR * 0.85}
                className={css.ghostNode}
                onMouseEnter={() =>
                  setHoverSeg({ afterId: v.vertex_id, x: mx, y: my })
                }
                onMouseLeave={() => setHoverSeg(null)}
                onClick={(e) => onSegmentClick(e, v.vertex_id, mx, my)}
              />
            ) : null}
          </g>
        );
      })}
      {sorted.map((v) => {
        const p = screenOf(v);
        const selected = selectedId === v.vertex_id;
        return (
          <circle
            key={v.vertex_id}
            cx={p.x}
            cy={p.y}
            r={selected ? nodeR * 1.25 : nodeR}
            className={`${css.node} ${selected ? css.nodeSelected : ""}`}
            onPointerDown={(e) => onNodePointerDown(e, v.vertex_id)}
            onContextMenu={(e) => onNodeContextMenu(e, v.vertex_id)}
          />
        );
      })}
      {hoverSeg && !locked ? (
        <text
          x={hoverSeg.x}
          y={hoverSeg.y - nodeR * 1.4}
          className={css.ghostLabel}
          fontSize={Math.max(vbW, vbH) * 0.03}
        >
          +
        </text>
      ) : null}
    </svg>
  );
}
