"use client";

import { useMemo, useRef, useState } from "react";
import {
  deleteBoundaryVertex,
  insertBoundaryVertex,
  moveBoundaryVertex,
} from "@workstream/domain";
import type { SiteBoundaryLite } from "../../lib/canvas-types";
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
}: Omit<SharedProps, "onChange">) {
  const locked = boundary?.status === "VERIFIED";
  return (
    <>
      <div className={css.toolbar} role="toolbar" aria-label="Boundary tools">
        <button
          type="button"
          className={`${css.tool} ${tool === "auto" ? css.toolActive : ""}`}
          title="AI Auto-Trace (A) — Vicmap parcel when available"
          disabled={pending}
          onClick={() => {
            onToolChange("auto");
            onAutoTrace();
          }}
        >
          ✦
          <span>Trace</span>
        </button>
        <button
          type="button"
          className={`${css.tool} ${tool === "edit" ? css.toolActive : ""}`}
          title="Edit Nodes (V)"
          disabled={pending || !boundary}
          onClick={() => onToolChange("edit")}
        >
          ✎
          <span>Edit</span>
        </button>
        <button
          type="button"
          className={`${css.tool} ${tool === "add" ? css.toolActive : ""}`}
          title="Add Node (P)"
          disabled={pending || !boundary || locked}
          onClick={() => onToolChange("add")}
        >
          +
          <span>Add</span>
        </button>
        <button
          type="button"
          className={`${css.tool} ${locked ? css.toolLocked : ""}`}
          title={locked ? "Unlock boundary" : "Lock Boundary (L)"}
          disabled={pending || !boundary}
          onClick={() => (locked ? onUnlock() : onLock())}
        >
          {locked ? "🔒" : "🔓"}
          <span>{locked ? "Locked" : "Lock"}</span>
        </button>
        <button
          type="button"
          className={css.tool}
          title="Reset vector (Esc)"
          disabled={pending || !boundary}
          onClick={onReset}
        >
          ⌫
          <span>Reset</span>
        </button>
        <button
          type="button"
          className={`${css.tool} ${tool === "pan" ? css.toolActive : ""}`}
          title="Pan canvas"
          onClick={() => onToolChange("pan")}
        >
          ✥
          <span>Pan</span>
        </button>
      </div>

      {boundary ? (
        <div className={css.hud}>
          <span
            className={`${css.pill} ${locked ? css.pillVerified : css.pillDraft}`}
          >
            {locked
              ? "BOUNDARY LOCKED: VERIFIED"
              : "AI DRAFT: UNVERIFIED"}
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

/** Vector overlay in site metre-space (inside pan/zoom world). */
export function BoundaryOverlay({
  boundary,
  tool,
  onChange,
}: Pick<SharedProps, "boundary" | "tool" | "onChange">) {
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

  if (!boundary) return null;

  const pointsAttr = sorted
    .map((v) => `${v.canvas_coords.x},${boundary.height_m - v.canvas_coords.y}`)
    .join(" ");

  const locked = boundary.status === "VERIFIED";
  const stroke = locked ? "#5ea884" : "#c9955a";

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
    const canvas = {
      x: local.x,
      y: boundary.height_m - local.y,
    };
    onChange(
      fromDomain(
        moveBoundaryVertex(toDomain(boundary), dragRef.current.id, canvas),
      ),
    );
  };

  const onSegmentClick = (
    e: React.MouseEvent,
    afterId: string,
    mx: number,
    my: number,
  ) => {
    if (locked) return;
    if (tool !== "add" && tool !== "edit") return;
    e.stopPropagation();
    onChange(
      fromDomain(insertBoundaryVertex(toDomain(boundary), afterId, {
        x: mx,
        y: my,
      })),
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
      viewBox={`0 0 ${boundary.width_m} ${boundary.height_m}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerMove={onSvgPointerMove}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      style={{ pointerEvents: tool === "pan" ? "none" : "auto" }}
    >
      <polygon
        points={pointsAttr}
        className={locked ? css.polyLocked : css.polyDraft}
        stroke={stroke}
      />
      {sorted.map((v, i) => {
        const next = sorted[(i + 1) % sorted.length]!;
        const mx = (v.canvas_coords.x + next.canvas_coords.x) / 2;
        const my = (v.canvas_coords.y + next.canvas_coords.y) / 2;
        return (
          <g key={`seg-${v.vertex_id}`}>
            {!locked && (tool === "add" || tool === "edit") ? (
              <circle
                cx={mx}
                cy={boundary.height_m - my}
                r={Math.max(boundary.width_m, boundary.height_m) * 0.012}
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
        const r = Math.max(boundary.width_m, boundary.height_m) * 0.014;
        const selected = selectedId === v.vertex_id;
        return (
          <circle
            key={v.vertex_id}
            cx={v.canvas_coords.x}
            cy={boundary.height_m - v.canvas_coords.y}
            r={selected ? r * 1.25 : r}
            className={`${css.node} ${selected ? css.nodeSelected : ""}`}
            onPointerDown={(e) => onNodePointerDown(e, v.vertex_id)}
            onContextMenu={(e) => onNodeContextMenu(e, v.vertex_id)}
          />
        );
      })}
      {hoverSeg && !locked ? (
        <text
          x={hoverSeg.x}
          y={boundary.height_m - hoverSeg.y - rLabel(boundary)}
          className={css.ghostLabel}
          fontSize={Math.max(boundary.width_m, boundary.height_m) * 0.03}
        >
          +
        </text>
      ) : null}
    </svg>
  );
}

function rLabel(boundary: SiteBoundaryLite) {
  return Math.max(boundary.width_m, boundary.height_m) * 0.02;
}
