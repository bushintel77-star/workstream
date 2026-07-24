"use client";

import type { ReactNode } from "react";
import type { StudioItemType } from "./studioCatalog";
import { BY_TYPE } from "./studioCatalog";
import {
  planLineKindForItem,
  PLAN_LINES_DARK,
  PLAN_LINES_LIGHT,
} from "./geometry/planLineStyles";
import {
  hatchUrlFor,
  sunShadowFillFrom,
} from "./features/render/renderTokens";
import { useSunShadow } from "./features/render/SunShadowContext";

/**
 * Plan symbols — clean, modern landscape-CAD language on the blush field.
 *
 * Design intent (2026, not old dirty CAD): thin consistent strokes, soft
 * on-palette tones, light airy hatching, generous negative space. Type reads
 * at a glance (stone grid ≠ timber plank ≠ softscape stipple ≠ drain dots)
 * without heavy near-black ink or muddy dense fills.
 *
 * Line weights come from the plan ladder (hardscape / planting / existing).
 * Material fills for paving/deck use shared SVG hatch defs (RenderDefs).
 */
export function StudioGlyph({
  type,
  ink = false,
  night = false,
}: {
  type: StudioItemType;
  ink?: boolean;
  /** Night board — chalk shadows + night hatch variants. Fit sheet is never night. */
  night?: boolean;
}) {
  const kind = planLineKindForItem(type);
  const ladder = night ? PLAN_LINES_DARK[kind] : PLAN_LINES_LIGHT[kind];
  const edgeW = ladder.strokeWidth;

  // Soft, refined palette — muted, never near-black or neon.
  const LINE = night ? "rgba(236,239,244,0.75)" : ink ? "#5A4650" : "#6E5A62";
  const GREEN = night ? "rgba(180,210,170,0.8)" : ink ? "#6E8B63" : "#7A9670";
  const GREEN_DEEP = night
    ? "rgba(160,190,150,0.85)"
    : ink
      ? "#557049"
      : "#5F7A50";
  const STONE = night ? "rgba(236,239,244,0.72)" : ink ? "#8C8B93" : "#9A9AA0";
  const TIMBER = night ? "rgba(220,190,150,0.8)" : ink ? "#B58A5E" : "#C09468";
  const WATER = night ? "#8fb0ff" : ink ? "#6C8598" : "#7C97AB";
  const greenFill = "rgba(122, 150, 112, 0.14)";
  const airFill = "rgba(122, 150, 112, 0.07)";

  const sun = useSunShadow();
  const def = BY_TYPE[type];
  const castsShadow =
    Boolean(def.canopyM) || (def.heightM != null && def.heightM > 0);
  const canopyR = 44;
  const shadow = castsShadow ? (
    <ellipse
      data-testid="sun-shadow"
      cx={50 + canopyR * sun.dxFactor}
      cy={50 + canopyR * sun.dyFactor}
      rx={canopyR * 0.82}
      ry={canopyR * 0.42}
      fill={sunShadowFillFrom(sun, night)}
      style={{ mixBlendMode: "multiply" }}
    />
  ) : null;

  const branch = (n: number, r1: number, r2: number, s: string, off = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((i * 360) / n + off) * (Math.PI / 180);
      return (
        <line
          key={i}
          x1={50 + r1 * Math.cos(a)}
          y1={50 + r1 * Math.sin(a)}
          x2={50 + r2 * Math.cos(a)}
          y2={50 + r2 * Math.sin(a)}
          stroke={s}
          strokeWidth={Math.max(0.7, edgeW)}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    });

  const stretch =
    type === "paving" ||
    type === "deck" ||
    type === "lawn" ||
    type === "hedge" ||
    type === "bed" ||
    type === "frenchdrain";

  let children: ReactNode = null;
  switch (type) {
    case "canopy":
      children = (
        <>
          <circle
            cx={50}
            cy={50}
            r={45}
            stroke={GREEN}
            strokeWidth={edgeW}
            fill={greenFill}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={50}
            cy={50}
            r={30}
            stroke={GREEN}
            strokeWidth={Math.max(0.5, edgeW * 0.85)}
            strokeDasharray="1.5 3"
            fill="none"
            opacity={0.6}
            vectorEffect="non-scaling-stroke"
          />
          {branch(7, 8, 40, "rgba(95,122,80,0.5)", 12)}
          <circle cx={50} cy={50} r={2.4} fill={GREEN_DEEP} />
        </>
      );
      break;
    case "feature":
      children = (
        <>
          <circle
            cx={50}
            cy={50}
            r={45}
            stroke={GREEN_DEEP}
            strokeWidth={edgeW}
            fill={airFill}
            vectorEffect="non-scaling-stroke"
          />
          {branch(12, 6, 34, "rgba(95,122,80,0.55)", 15)}
          {branch(12, 34, 42, "rgba(95,122,80,0.32)", 15)}
          <circle cx={50} cy={50} r={2} fill={GREEN_DEEP} />
        </>
      );
      break;
    case "paving":
      children = (
        <>
          <rect
            x={5}
            y={7}
            width={90}
            height={86}
            rx={2}
            stroke={STONE}
            strokeWidth={edgeW}
            fill={hatchUrlFor("bluestone", night)}
            vectorEffect="non-scaling-stroke"
          />
        </>
      );
      break;
    case "deck":
      children = (
        <>
          <rect
            x={5}
            y={7}
            width={90}
            height={86}
            rx={2}
            stroke={TIMBER}
            strokeWidth={edgeW}
            fill={hatchUrlFor("deck", night)}
            vectorEffect="non-scaling-stroke"
          />
        </>
      );
      break;
    case "lawn":
      children = (
        <>
          <rect
            x={5}
            y={7}
            width={90}
            height={86}
            rx={6}
            stroke={GREEN}
            strokeWidth={edgeW}
            fill={airFill}
            strokeDasharray="3 3.5"
            vectorEffect="non-scaling-stroke"
          />
          {[24, 42, 60, 78].flatMap((y, r) =>
            [18, 34, 50, 66, 82].map((x) => (
              <circle
                key={`${y}-${x}`}
                cx={x + (r % 2 ? 8 : 0)}
                cy={y}
                r={0.9}
                fill="rgba(95,122,80,0.42)"
              />
            )),
          )}
        </>
      );
      break;
    case "hedge":
      children = (
        <>
          <rect
            x={4}
            y={30}
            width={92}
            height={40}
            rx={6}
            stroke={GREEN_DEEP}
            strokeWidth={edgeW}
            fill={greenFill}
            vectorEffect="non-scaling-stroke"
          />
          {Array.from({ length: 12 }, (_, i) => (
            <circle
              key={`t${i}`}
              cx={8 + i * 7.6}
              cy={30}
              r={3.4}
              stroke="rgba(95,122,80,0.5)"
              strokeWidth={Math.max(0.55, edgeW)}
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <circle
              key={`b${i}`}
              cx={8 + i * 7.6}
              cy={70}
              r={3.4}
              stroke="rgba(95,122,80,0.5)"
              strokeWidth={Math.max(0.55, edgeW)}
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </>
      );
      break;
    case "bed":
      children = (
        <>
          <ellipse
            cx={50}
            cy={50}
            rx={45}
            ry={33}
            stroke={GREEN}
            strokeWidth={edgeW}
            fill={greenFill}
            vectorEffect="non-scaling-stroke"
          />
          {[
            [30, 40],
            [50, 34],
            [70, 40],
            [24, 55],
            [42, 52],
            [58, 52],
            [76, 55],
            [36, 66],
            [64, 66],
            [50, 58],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={2.6}
              stroke="rgba(95,122,80,0.5)"
              strokeWidth={Math.max(0.55, edgeW)}
              fill="rgba(122,150,112,0.28)"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </>
      );
      break;
    case "frenchdrain":
      children = (
        <>
          <line
            x1={6}
            y1={50}
            x2={94}
            y2={50}
            stroke={WATER}
            strokeWidth={Math.max(1.1, edgeW * 1.8)}
            strokeDasharray="1.5 5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={i} cx={10 + i * 10} cy={50} r={1.5} fill={WATER} />
          ))}
        </>
      );
      break;
    case "exist":
      children = (
        <>
          <circle
            cx={50}
            cy={50}
            r={44}
            stroke={LINE}
            strokeWidth={edgeW}
            fill="none"
            strokeDasharray={ladder.dash ?? "2.5 2"}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={50}
            cy={50}
            r={29}
            stroke="rgba(232,184,75,0.85)"
            strokeWidth={edgeW}
            fill="none"
            strokeDasharray="2.5 3.5"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={40}
            y1={50}
            x2={60}
            y2={50}
            stroke={LINE}
            strokeWidth={edgeW}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={50}
            y1={40}
            x2={50}
            y2={60}
            stroke={LINE}
            strokeWidth={edgeW}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={50} cy={50} r={2.4} fill={LINE} />
        </>
      );
      break;
  }

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio={stretch ? "none" : "xMidYMid meet"}
      style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}
      aria-hidden
    >
      {shadow}
      {children}
    </svg>
  );
}
