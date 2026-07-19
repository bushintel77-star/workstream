"use client";

import { useEffect, useRef, useState } from "react";
import type { SpotLevel } from "../../studioCatalog";
import type { LayerOpacity } from "../../state/studioTypes";
import type { PctPoint } from "../../geometry";
import type { StudioTool } from "../../studioCatalog";
import css from "./surveyAnnotations.module.css";

type Props = {
  active: boolean;
  tool: StudioTool;
  levels: SpotLevel[];
  services: PctPoint[][];
  scaleM: number;
  darkOn: boolean;
  layerOpacity: LayerOpacity;
  onAddLevel: (x: number, y: number, z: number) => void;
  onCommitService: (ring: PctPoint[]) => void;
  onCalibrate: (scaleM: number) => void;
};

/**
 * Survey CAD annotations — spot levels, service/easement traces, two-point
 * scale calibration. Geometry stays in a stretch SVG; labels are fixed-px
 * HTML overlays so they never stretch with the board aspect ratio.
 */
export function SurveyAnnotationLayer({
  active,
  tool,
  levels,
  services,
  scaleM,
  darkOn,
  layerOpacity,
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
  const surveyOp = layerOpacity.survey;
  const councilOp = layerOpacity.council;
  const serviceRings = [...services, drawService].filter(Boolean) as PctPoint[][];

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
          </g>
        ))}

        {levels.slice(1).map((lv, i) => {
          const a = levels[i]!;
          const b = lv;
          const distM = (Math.hypot(b.x - a.x, b.y - a.y) / 100) * scaleM;
          if (distM < 0.2) return null;
          return (
            <g
              key={`fall${i}`}
              opacity={surveyOp}
              style={{ pointerEvents: "none" }}
              data-testid="survey-fall"
            >
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={darkOn ? "rgba(230,233,234,0.5)" : "rgba(28,25,23,0.4)"}
                strokeWidth={0.14}
                strokeDasharray="0.5 0.7"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
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
            Service / easement
          </span>
        ) : null,
      )}

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
          {lv.z.toFixed(2)}
        </span>
      ))}

      {levels.slice(1).map((lv, i) => {
        const a = levels[i]!;
        const b = lv;
        const distM = (Math.hypot(b.x - a.x, b.y - a.y) / 100) * scaleM;
        if (distM < 0.2) return null;
        const dz = b.z - a.z;
        const fall = Math.abs((dz / distM) * 100).toFixed(1);
        return (
          <span
            key={`falllab${i}`}
            className={css.fallLabel}
            style={{
              left: `${(a.x + b.x) / 2}%`,
              top: `${(a.y + b.y) / 2}%`,
              opacity: surveyOp,
            }}
          >
            {fall}% · {Math.round(Math.abs(dz) * 1000)} mm
          </span>
        );
      })}

      {tool === "service" && drawService ? (
        <p className={css.hint}>
          Service trace · {drawService.length} pts · Enter to finish · Esc cancel
        </p>
      ) : null}
      {tool === "level" ? (
        <p className={css.hint}>Click to place a spot level (RL)</p>
      ) : null}
      {tool === "calib" ? (
        <p className={css.hint}>
          Calibrate · click two points with a known title distance
          {calibPts.length === 1 ? " · click second point" : ""}
        </p>
      ) : null}
    </div>
  );
}
