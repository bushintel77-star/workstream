"use client";

import { useEffect, useRef, useState } from "react";
import type { SpotLevel } from "../../studioCatalog";
import type { LayerKey, LayerOpacity } from "../../state/studioTypes";
import { resolveLayerVisual } from "../../state/layerIsolate";
import type { PctPoint } from "../../geometry";
import { nearSurveyRingStart } from "../../geometry/surveyCorridor";
import type { StudioTool } from "../../studioCatalog";
import { buildSpotLevelFall } from "./spotLevelFall";
import { CameraChrome } from "../../CameraChrome";
import css from "./surveyAnnotations.module.css";

type Props = {
  active: boolean;
  tool: StudioTool;
  levels: SpotLevel[];
  services: PctPoint[][];
  easements?: PctPoint[][];
  /** Corridors are already rendered by CadPlanBoard outside Survey mode. */
  showCorridors?: boolean;
  scaleM: number;
  darkOn: boolean;
  layerOpacity: LayerOpacity;
  isolatedLayer?: LayerKey | null;
  onAddLevel: (x: number, y: number, z: number) => void;
  onCommitService: (ring: PctPoint[]) => void;
  onCalibrate: (scaleM: number) => void;
};

/**
 * Survey CAD annotations — spot levels, service/easement traces, two-point
 * scale calibration. Geometry stays in a stretch SVG; labels are fixed-px
 * HTML overlays so they never stretch with the board aspect ratio.
 *
 * Servc tool honesty: 2 pts → service corridor; ≥3 pts (Enter or click
 * near start) → easement hatch ring persisted on site_frame.
 */
export function SurveyAnnotationLayer({
  active,
  tool,
  levels,
  services,
  easements = [],
  showCorridors = true,
  scaleM,
  darkOn,
  layerOpacity,
  isolatedLayer = null,
  onAddLevel,
  onCommitService,
  onCalibrate,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [drawService, setDrawService] = useState<PctPoint[] | null>(null);
  const [calibPts, setCalibPts] = useState<PctPoint[]>([]);

  useEffect(() => {
    if (!active) {
      setDrawService(null);
      setCalibPts([]);
    }
  }, [active]);

  useEffect(() => {
    if (tool !== "service") setDrawService(null);
    if (tool !== "calib") setCalibPts([]);
  }, [tool]);

  useEffect(() => {
    if (!active || tool !== "service") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && drawService && drawService.length >= 2) {
        e.preventDefault();
        onCommitService(drawService);
        setDrawService(null);
      }
      if (e.key === "Escape") {
        setDrawService(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, tool, drawService, onCommitService]);

  const toPct = (clientX: number, clientY: number): PctPoint => {
    const el = rootRef.current;
    if (!el) return { x: 50, y: 50 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100)),
    };
  };

  const capturing =
    active && (tool === "level" || tool === "service" || tool === "calib");

  const ink = darkOn ? "#E6E9EA" : "#1C1917";
  // Levels, service corridors and easements are one "Services & utilities"
  // layer on the single canvas — toggled/dimmed together, never a separate tab.
  const servicesVisual = resolveLayerVisual(
    "services",
    layerOpacity.services,
    isolatedLayer,
  );
  const surveyOp = servicesVisual.opacity;
  const councilOp = servicesVisual.opacity;
  // Committed corridors render here in Survey; on the CAD canvas they come from
  // CadPlanBoard, so only the in-progress trace is drawn to avoid doubling.
  const serviceRings = (
    showCorridors ? [...services, drawService] : [drawService]
  ).filter(Boolean) as PctPoint[][];
  const falls = levels
    .slice(1)
    .map((level, index) => buildSpotLevelFall(levels[index]!, level, scaleM))
    .filter((fall): fall is NonNullable<typeof fall> => fall != null);

  return (
    <div
      ref={rootRef}
      className={css.root}
      data-testid="survey-annotation-layer"
      data-capturing={capturing ? "true" : "false"}
      style={{ pointerEvents: capturing ? "auto" : "none" }}
      onPointerDown={(e) => {
        if (!capturing) return;
        e.stopPropagation();
        const p = toPct(e.clientX, e.clientY);
        if (tool === "level") {
          const raw = window.prompt("Spot level (m AHD / RL)", "0.00");
          if (raw == null) return;
          const z = Number.parseFloat(raw);
          if (!Number.isFinite(z)) return;
          onAddLevel(p.x, p.y, z);
          return;
        }
        if (tool === "service") {
          if (
            drawService &&
            drawService.length >= 2 &&
            nearSurveyRingStart(drawService, p)
          ) {
            onCommitService(drawService);
            setDrawService(null);
            return;
          }
          setDrawService((prev) => (prev ? [...prev, p] : [p]));
          return;
        }
        if (tool === "calib") {
          const next = [...calibPts, p].slice(0, 2);
          setCalibPts(next);
          if (next.length === 2) {
            const a = next[0]!;
            const b = next[1]!;
            const distPct = Math.hypot(b.x - a.x, b.y - a.y);
            const known = window.prompt(
              "Known distance between these points (metres)",
              "10",
            );
            setCalibPts([]);
            if (known == null) return;
            const knownM = Number.parseFloat(known);
            if (!Number.isFinite(knownM) || knownM <= 0 || distPct < 0.5) return;
            onCalibrate(+((knownM * 100) / distPct).toFixed(1));
          }
        }
      }}
    >
      <svg
        className={css.svg}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <marker
            id="survey-fall-arrow"
            markerWidth="5"
            markerHeight="5"
            refX="4"
            refY="2.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L5,2.5 L0,5 Z" fill={ink} />
          </marker>
        </defs>
        {serviceRings.map((s, si) => (
          <g key={`svc${si}`} opacity={councilOp} style={{ pointerEvents: "none" }}>
            <polyline
              points={s.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#57534E"
              strokeWidth={0.28}
              strokeDasharray="1.6 1"
              vectorEffect="non-scaling-stroke"
            />
            {s.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={0.4} fill="#57534E" />
            ))}
          </g>
        ))}

        {showCorridors
          ? easements
          .filter((r) => r.length >= 3)
          .map((ring, i) => (
            <g
              key={`ease${i}`}
              opacity={councilOp}
              style={{ pointerEvents: "none" }}
              data-testid="survey-easement-ring"
            >
              <polygon
                points={ring.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#57534E"
                strokeWidth={0.3}
                strokeDasharray="1.2 0.8"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))
          : null}

        {calibPts.length > 0 ? (
          <g style={{ pointerEvents: "none" }}>
            {calibPts.length === 2 ? (
              <line
                x1={calibPts[0]!.x}
                y1={calibPts[0]!.y}
                x2={calibPts[1]!.x}
                y2={calibPts[1]!.y}
                stroke="#1C1917"
                strokeWidth={0.25}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {calibPts.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={0.7}
                fill="none"
                stroke="#1C1917"
                strokeWidth={0.25}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ) : null}

        {levels.map((lv, i) => (
          <g
            key={`lv${i}`}
            opacity={surveyOp}
            style={{ pointerEvents: "none" }}
            data-testid="survey-spot-level"
          >
            <path
              d={`M ${lv.x} ${lv.y - 1.1} L ${lv.x - 0.9} ${lv.y + 0.55} L ${lv.x + 0.9} ${lv.y + 0.55} Z`}
              fill="none"
              stroke={ink}
              strokeWidth={0.2}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={lv.x}
              y1={lv.y - 4.2}
              x2={lv.x}
              y2={lv.y - 1.1}
              stroke={ink}
              strokeWidth={0.18}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={lv.x}
              cy={lv.y - 4.2}
              r={0.42}
              fill={ink}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {falls.map((fall, i) => (
            <g
              key={`fall${i}`}
              opacity={surveyOp}
              style={{ pointerEvents: "none" }}
              data-testid="survey-fall"
            >
              <line
                x1={fall.high.x}
                y1={fall.high.y}
                x2={fall.low.x}
                y2={fall.low.y}
                stroke={darkOn ? "rgba(230,233,234,0.5)" : "rgba(28,25,23,0.4)"}
                strokeWidth={0.14}
                strokeDasharray="0.5 0.7"
                markerEnd={fall.flat ? undefined : "url(#survey-fall-arrow)"}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
      </svg>

      {/* Fixed-px labels — never stretch with preserveAspectRatio="none" */}
      {serviceRings.map((s, si) =>
        s.length > 1 ? (
          <span
            key={`svclab${si}`}
            className={css.serviceLabel}
            style={{
              left: `${s[0]!.x}%`,
              top: `${s[0]!.y}%`,
              opacity: councilOp,
            }}
          >
            {s.length >= 3 ? "Easement" : "Service"}
          </span>
        ) : null,
      )}

      {showCorridors ? easements.map((ring, i) =>
        ring.length >= 3 ? (
          <span
            key={`easelab${i}`}
            className={css.serviceLabel}
            style={{
              left: `${ring[0]!.x}%`,
              top: `${ring[0]!.y}%`,
              opacity: councilOp,
            }}
          >
            Easement
          </span>
        ) : null,
      ) : null}

      {levels.map((lv, i) => (
        <span
          key={`lvlab${i}`}
          className={css.levelLabel}
          style={{
            left: `${lv.x}%`,
            top: `${lv.y}%`,
            opacity: surveyOp,
            color: ink,
          }}
        >
          P{i + 1} · RL {lv.z.toFixed(2)} m
        </span>
      ))}

      {falls.map((fall, i) => (
          <span
            key={`falllab${i}`}
            className={css.fallLabel}
            style={{
              left: `${(fall.high.x + fall.low.x) / 2}%`,
              top: `${(fall.high.y + fall.low.y) / 2}%`,
              opacity: surveyOp,
            }}
          >
            {fall.flat ? "LEVEL" : `↓ ${fall.fallPct}%`} · {fall.deltaMm} mm
          </span>
        ))}

      {tool === "service" && drawService ? (
        <CameraChrome>
          <p className={css.hint} data-testid="survey-service-hint">
            {drawService.length >= 3
              ? `Easement hatch · ${drawService.length} pts · Enter or click start to finish · Esc cancel`
              : `Service / easement · ${drawService.length} pts · 2 pts = service · ≥3 = easement · Enter finish`}
          </p>
        </CameraChrome>
      ) : null}
      {tool === "level" ? (
        <CameraChrome>
          <p className={css.hint}>Click to place a spot level (RL)</p>
        </CameraChrome>
      ) : null}
      {tool === "calib" ? (
        <CameraChrome>
          <p className={css.hint}>
            Calibrate · click two points with a known title distance
            {calibPts.length === 1 ? " · click second point" : ""}
          </p>
        </CameraChrome>
      ) : null}
    </div>
  );
}
