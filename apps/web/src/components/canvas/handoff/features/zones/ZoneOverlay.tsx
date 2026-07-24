"use client";

import { useEffect, useRef, useState } from "react";
import type { IrrigationZone, IrrigationZoneKind } from "@workstream/contracts";
import {
  zoneKindDrawHint,
  zoneKindShortLabel,
} from "@workstream/domain";
import type { PctPoint } from "../../geometry";
import type { BoardCamera } from "../../geometry/cameraPointer";
import { CameraChrome } from "../../CameraChrome";
import css from "./zones.module.css";

type Props = {
  active: boolean;
  kind: IrrigationZoneKind;
  zones: IrrigationZone[];
  /** Live board camera — zone labels portal through it. */
  cam?: BoardCamera;
  serviceFeatureHidden?: Record<string, boolean>;
  focusedServiceIds?: string[] | null;
  onCommit: (points: PctPoint[], kind: IrrigationZoneKind) => void;
};

function strokeFor(kind: IrrigationZoneKind): {
  color: string;
  dash: string;
  width: number;
} {
  switch (kind) {
    case "lighting":
      return { color: "#57534E", dash: "1.4 1.1", width: 0.35 };
    case "lighting_conduit":
      return { color: "#78716C", dash: "0.9 0.55", width: 0.42 };
    case "spray":
      return { color: "#15803D", dash: "2.2 0.7", width: 0.38 };
    case "agg_drain":
      return { color: "#92400E", dash: "1.1 0.7 0.35 0.7", width: 0.4 };
    case "drip":
    default:
      return { color: "#3F6212", dash: "2 0.9", width: 0.35 };
  }
}

/** Tick marks along a spray / lighting path for heads / fixtures. */
function headTicks(
  pts: PctPoint[],
  spacingPct: number,
): Array<{ x: number; y: number }> {
  if (pts.length < 2 || spacingPct <= 0) return [];
  const out: Array<{ x: number; y: number }> = [];
  let carry = 0;
  out.push({ ...pts[0]! });
  for (let i = 1; i < pts.length; i += 1) {
    let ax = pts[i - 1]!.x;
    let ay = pts[i - 1]!.y;
    const b = pts[i]!;
    let seg = Math.hypot(b.x - ax, b.y - ay);
    const ux = (b.x - ax) / (seg || 1);
    const uy = (b.y - ay) / (seg || 1);
    while (carry + seg >= spacingPct) {
      const need = spacingPct - carry;
      ax += ux * need;
      ay += uy * need;
      out.push({ x: ax, y: ay });
      seg -= need;
      carry = 0;
    }
    carry += seg;
  }
  return out;
}

/**
 * Authored drip / lighting / conduit / spray / agg-drain paths.
 * Enter finishes; Esc cancels. Feeds DesignCanvas.irrigation_zones ΓåÆ BOM.
 */
export function ZoneOverlay({
  active,
  kind,
  zones,
  cam,
  serviceFeatureHidden = {},
  focusedServiceIds = null,
  onCommit,
}: Props) {
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

  const focusOn = (focusedServiceIds?.length ?? 0) > 0;
  const rings = [
    ...zones
      .filter((z) => !serviceFeatureHidden[`zone:${z.id}`])
      .map((z) => {
        const ledgerId = `zone:${z.id}`;
        const dimmed =
          focusOn && !(focusedServiceIds ?? []).includes(ledgerId);
        return {
          id: z.id,
          kind: (z.kind ?? "drip") as IrrigationZoneKind,
          pts: z.points.map((pt) => ({ x: pt.x_pct, y: pt.y_pct })),
          name: z.name,
          spacingM: z.fixture_spacing_m ?? 2.5,
          opacity: dimmed ? 0.12 : 1,
        };
      }),
    ...(draft
      ? [
          {
            id: "draft",
            kind,
            pts: draft,
            name: "draft",
            spacingM: 2.5,
            opacity: 0.7,
          },
        ]
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
        {rings.map((r) => {
          const stroke = strokeFor(r.kind);
          const showHeads =
            r.kind === "spray" ||
            r.kind === "lighting" ||
            r.kind === "lighting_conduit";
          // ~ board % for ~2.5ΓÇô3.5 m at scale ~110 m ΓåÆ ~2.3ΓÇô3.2 %
          const tickPct =
            r.kind === "spray" ? 3.2 : r.kind === "lighting_conduit" ? 8 : 2.3;
          const ticks = showHeads ? headTicks(r.pts, tickPct) : [];
          const fitPt =
            r.kind === "lighting_conduit" && r.pts.length >= 2
              ? r.pts[r.pts.length - 1]!
              : null;
          return (
            <g
              key={r.id}
              data-testid={
                r.id === "draft" ? "zone-draft" : `zone-path-${r.kind}`
              }
            >
              <polyline
                points={r.pts.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={stroke.color}
                strokeWidth={stroke.width}
                strokeDasharray={stroke.dash}
                vectorEffect="non-scaling-stroke"
                opacity={r.opacity}
              />
              {r.pts.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={0.45}
                  fill={stroke.color}
                />
              ))}
              {ticks.slice(1).map((p, i) => (
                <circle
                  key={`h-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={r.kind === "spray" ? 0.7 : 0.55}
                  fill="none"
                  stroke={stroke.color}
                  strokeWidth={0.25}
                  vectorEffect="non-scaling-stroke"
                  data-testid={
                    r.kind === "spray" ? "zone-spray-head" : "zone-fixture-tick"
                  }
                />
              ))}
              {fitPt ? (
                <g data-testid="zone-house-fitoff">
                  <rect
                    x={fitPt.x - 1.1}
                    y={fitPt.y - 1.1}
                    width={2.2}
                    height={2.2}
                    fill="rgba(242, 240, 235, 0.95)"
                    stroke={stroke.color}
                    strokeWidth={0.28}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={fitPt.x}
                    y={fitPt.y + 0.45}
                    textAnchor="middle"
                    className={css.fitoffGlyph}
                  >
                    M
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>

      {zones.map((z) => {
        const p0 = z.points[0];
        if (!p0) return null;
        const kindZ = (z.kind ?? "drip") as IrrigationZoneKind;
        const labelPct: PctPoint = { x: p0.x_pct, y: p0.y_pct };
        const labelNode = (
          <span className={css.label}>
            {zoneKindShortLabel(kindZ)} ┬╖ {z.name}
          </span>
        );
        return cam ? (
          <CameraChrome
            key={z.id}
            place={{
              kind: "project",
              pct: labelPct,
              cam,
              transform: "none",
            }}
          >
            {labelNode}
          </CameraChrome>
        ) : (
          <span
            key={z.id}
            className={css.label}
            style={{
              position: "absolute",
              left: `${labelPct.x}%`,
              top: `${labelPct.y}%`,
            }}
          >
            {zoneKindShortLabel(kindZ)} ┬╖ {z.name}
          </span>
        );
      })}

      {active ? (
        <CameraChrome>
          <p className={css.hint} data-testid="zone-draw-hint">
            {zoneKindDrawHint(kind)} ┬╖ {draft?.length ?? 0} pts ┬╖ Enter finish ┬╖
            Esc cancel
          </p>
        </CameraChrome>
      ) : null}
    </div>
  );
}
