"use client";

import { useEffect, useRef, useState } from "react";
import type { IrrigationZone, IrrigationZoneKind } from "@workstream/contracts";
import type { PctPoint } from "../../geometry";
import { BoardChromePortal } from "../../BoardChromePortal";
import css from "./zones.module.css";

type Props = {
  active: boolean;
  kind: IrrigationZoneKind;
  zones: IrrigationZone[];
  onCommit: (points: PctPoint[], kind: IrrigationZoneKind) => void;
};

/**
 * Authored drip / lighting paths — Enter finishes; Esc cancels.
 * Feeds DesignCanvas.irrigation_zones → Advanced BOM.
 */
export function ZoneOverlay({ active, kind, zones, onCommit }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<PctPoint[] | null>(null);

  useEffect(() => {
    if (!active) setDraft(null);
  }, [active]);

  useEffect(() => {
    setDraft(null);
  }, [kind]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && draft && draft.length >= 2) {
        e.preventDefault();
        onCommit(draft, kind);
        setDraft(null);
      }
      if (e.key === "Escape") {
        setDraft(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, draft, kind, onCommit]);

  const toPct = (clientX: number, clientY: number): PctPoint => {
    const el = rootRef.current;
    if (!el) return { x: 50, y: 50 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100)),
    };
  };

  const rings = [
    ...zones.map((z) => ({
      id: z.id,
      kind: (z.kind ?? "drip") as IrrigationZoneKind,
      pts: z.points.map((p) => ({ x: p.x_pct, y: p.y_pct })),
      name: z.name,
    })),
    ...(draft
      ? [{ id: "draft", kind, pts: draft, name: "draft" }]
      : []),
  ];

  return (
    <div
      ref={rootRef}
      className={css.root}
      data-testid="zone-overlay"
      data-active={active ? "true" : "false"}
      style={{ pointerEvents: active ? "auto" : "none" }}
      onPointerDown={(e) => {
        if (!active) return;
        e.stopPropagation();
        const p = toPct(e.clientX, e.clientY);
        setDraft((prev) => (prev ? [...prev, p] : [p]));
      }}
    >
      <svg
        className={css.svg}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {rings.map((r) => (
          <g
            key={r.id}
            data-testid={
              r.id === "draft" ? "zone-draft" : `zone-path-${r.kind}`
            }
          >
            <polyline
              points={r.pts.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={r.kind === "lighting" ? "#57534E" : "#3F6212"}
              strokeWidth={0.35}
              strokeDasharray={r.kind === "lighting" ? "1.4 1.1" : "2 0.9"}
              vectorEffect="non-scaling-stroke"
              opacity={r.id === "draft" ? 0.7 : 0.9}
            />
            {r.pts.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={0.45}
                fill={r.kind === "lighting" ? "#57534E" : "#3F6212"}
              />
            ))}
          </g>
        ))}
      </svg>

      {zones.map((z) =>
        z.points[0] ? (
          <span
            key={z.id}
            className={css.label}
            style={{
              left: `${z.points[0].x_pct}%`,
              top: `${z.points[0].y_pct}%`,
            }}
          >
            {(z.kind ?? "drip") === "lighting" ? "Light" : "Drip"} · {z.name}
          </span>
        ) : null,
      )}

      {active ? (
        <BoardChromePortal>
          <p className={css.hint} data-testid="zone-draw-hint">
            {kind === "lighting" ? "Lighting run" : "Drip zone"} ·{" "}
            {draft?.length ?? 0} pts · Enter finish · Esc cancel
          </p>
        </BoardChromePortal>
      ) : null}
    </div>
  );
}
