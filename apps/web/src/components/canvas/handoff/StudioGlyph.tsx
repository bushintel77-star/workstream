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
  hatchKindForSymbol,
  hatchUrlFor,
  SUN_SHADOW,
  sunShadowFill,
  type HatchKind,
} from "./features/render/renderTokens";
import { useGlyphSunShadow } from "./features/shade/SunShadowContext";
import {
  CSS_TOKEN,
  mixOnCanvas,
  semanticForTheme,
} from "../../../styles/colorTokens";

/**
 * Hatch family for a surface placement. `paving` and `deck` cover several
 * Curtis materials, so the placed catalog symbol decides which hatch is drawn —
 * porcelain should not read as bluestone. Returns null for types that carry no
 * hatch, so callers can skip the lookup entirely.
 */
export function planHatchForItem(
  type: StudioItemType,
  symbolId?: string,
): HatchKind | null {
  if (type === "paving") return hatchKindForSymbol(symbolId, "bluestone");
  if (type === "deck") return hatchKindForSymbol(symbolId, "deck");
  return null;
}

/** Materials whose edge reads as timber rather than stone. */
const TIMBER_HATCHES: ReadonlySet<HatchKind> = new Set<HatchKind>(["deck"]);
/** Materials whose edge reads as loose / earthy rather than cut stone. */
const EARTH_HATCHES: ReadonlySet<HatchKind> = new Set<HatchKind>([
  "gravel",
  "crazypave",
  "aggregate",
  "hoggin",
]);

/**
 * Plan symbols — landscape-CAD language on semantic colour tokens (v2).
 * Line weights from the plan ladder; materials from planting / stone / timber / water.
 */
export function StudioGlyph({
  type,
  ink = false,
  night = false,
  symbolId,
}: {
  type: StudioItemType;
  ink?: boolean;
  /** Night board — chalk shadows + night hatch variants. Fit sheet is never night. */
  night?: boolean;
  /** Placed catalog symbol — selects the material hatch for paving / deck. */
  symbolId?: string;
}) {
  const kind = planLineKindForItem(type);
  const ladder = night ? PLAN_LINES_DARK[kind] : PLAN_LINES_LIGHT[kind];
  const edgeW = ladder.strokeWidth;
  const sem = semanticForTheme(night);

  const LINE = ink || night ? sem.textPrimary : CSS_TOKEN.textSecondary;
  const GREEN = sem.plantingNewStroke;
  const GREEN_DEEP = sem.plantingRetainStroke;
  const STONE = night ? sem.bluestone : CSS_TOKEN.bluestone;
  const TIMBER = night ? sem.timber : CSS_TOKEN.timber;
  const WATER = night ? sem.water : CSS_TOKEN.water;
  const greenFill = mixOnCanvas(CSS_TOKEN.plantingNewStroke, 14);
  const airFill = mixOnCanvas(CSS_TOKEN.plantingNewStroke, 7);

  const def = BY_TYPE[type];
  const castsShadow =
    Boolean(def.canopyM) || (def.heightM != null && def.heightM > 0);
  const canopyR = 44;
  const { dx: shadowDx, dy: shadowDy } = useGlyphSunShadow(
    canopyR,
    SUN_SHADOW.dyFactor,
  );
  const shadow = castsShadow ? (
    <ellipse
      data-testid="sun-shadow"
      data-sun-dx={shadowDx.toFixed(2)}
      data-sun-dy={shadowDy.toFixed(2)}
      cx={50 + shadowDx}
      cy={50 + shadowDy}
      rx={canopyR * 0.82}
      ry={canopyR * 0.42}
      fill={sunShadowFill(night)}
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
          {branch(7, 8, 40, mixOnCanvas(CSS_TOKEN.plantingNewStroke, 50), 12)}
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
          {branch(12, 6, 34, mixOnCanvas(CSS_TOKEN.plantingNewStroke, 55), 15)}
          {branch(12, 34, 42, mixOnCanvas(CSS_TOKEN.plantingNewStroke, 32), 15)}
          <circle cx={50} cy={50} r={2} fill={GREEN_DEEP} />
        </>
      );
      break;
    case "paving":
    case "deck": {
      /*
       * One surface case for both: the material comes from the placed symbol,
       * so a granite stepper, crazy-pave or porcelain terrace each read as
       * themselves instead of defaulting to bluestone.
       */
      const hatch = planHatchForItem(type, symbolId) ?? "bluestone";
      const edge = TIMBER_HATCHES.has(hatch)
        ? TIMBER
        : EARTH_HATCHES.has(hatch)
          ? night
            ? sem.textSecondary
            : CSS_TOKEN.gravel
          : STONE;
      children = (
        <rect
          x={5}
          y={7}
          width={90}
          height={86}
          rx={2}
          stroke={edge}
          strokeWidth={edgeW}
          fill={hatchUrlFor(hatch, night)}
          vectorEffect="non-scaling-stroke"
        />
      );
      break;
    }
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
                fill={mixOnCanvas(CSS_TOKEN.plantingNewStroke, 42)}
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
              stroke={mixOnCanvas(CSS_TOKEN.plantingNewStroke, 50)}
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
              stroke={mixOnCanvas(CSS_TOKEN.plantingNewStroke, 50)}
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
              stroke={mixOnCanvas(CSS_TOKEN.plantingNewStroke, 50)}
              strokeWidth={Math.max(0.55, edgeW)}
              fill={mixOnCanvas(CSS_TOKEN.plantingNewStroke, 28)}
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
            stroke="var(--sds-compliance-amber)"
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
