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
 * scale calibration. Ported from curtis-co prototype PlanCanvas behaviour.
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

  const ink = darkOn ? "#E6E9EA" : "#241318";
  const surveyOp = layerOpacity.survey;
  const councilOp = layerOpacity.council;

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
        {[...services, drawService].filter(Boolean).map((s, si) => (
          <g key={`svc${si}`} opacity={councilOp} style={{ pointerEvents: "none" }}>
            <polyline
              points={s!.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#2F7D8C"
              strokeWidth={0.28}
              strokeDasharray="1.6 1"
              vectorEffect="non-scaling-stroke"
            />
            {s!.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={0.4} fill="#2F7D8C" />
            ))}
            {s!.length > 1 ? (
              <text
                x={s![0]!.x + 1}
                y={s![0]!.y - 1}
                fontSize={1.5}
                fill="#2F7D8C"
                fontFamily="IBM Plex Mono, ui-monospace, monospace"
              >
                SERVICE / EASEMENT
              </text>
            ) : null}
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
                stroke="#C2455F"
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
                stroke="#C2455F"
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
            <text
              x={lv.x + 1.3}
              y={lv.y + 0.4}
              fontSize={1.6}
              fill={ink}
              fontFamily="IBM Plex Mono, ui-monospace, monospace"
            >
              {lv.z.toFixed(2)}
            </text>
          </g>
        ))}

        {levels.slice(1).map((lv, i) => {
          const a = levels[i]!;
          const b = lv;
          const distM = (Math.hypot(b.x - a.x, b.y - a.y) / 100) * scaleM;
          if (distM < 0.2) return null;
          const dz = b.z - a.z;
          const fall = Math.abs((dz / distM) * 100).toFixed(1);
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
                stroke={darkOn ? "rgba(230,233,234,0.5)" : "rgba(36,19,24,0.4)"}
                strokeWidth={0.14}
                strokeDasharray="0.5 0.7"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 0.8}
                fontSize={1.5}
                textAnchor="middle"
                fill={darkOn ? "#E8B84B" : "#8A6A1F"}
                fontFamily="IBM Plex Mono, ui-monospace, monospace"
              >
                {fall}% · {Math.round(Math.abs(dz) * 1000)} mm
              </text>
            </g>
          );
        })}
      </svg>

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
