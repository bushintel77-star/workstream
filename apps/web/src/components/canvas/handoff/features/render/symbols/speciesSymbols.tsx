"use client";

import { seededRandom, wobbledCirclePath } from "../seededRandom";
import { SUN_SHADOW, sunShadowFill } from "../renderTokens";
import { useGlyphSunShadow } from "../../shade/SunShadowContext";

export type SymbolTone = {
  stroke: string;
  fill: string;
  night: boolean;
  ghost?: boolean;
};

function GlyphSoftShadow({ night }: { night: boolean }) {
  const r = 42;
  const { dx, dy } = useGlyphSunShadow(r, SUN_SHADOW.dyFactor);
  return (
    <ellipse
      data-testid="sun-shadow"
      data-sun-dx={dx.toFixed(2)}
      data-sun-dy={dy.toFixed(2)}
      cx={50 + dx}
      cy={50 + dy}
      rx={r * 0.82}
      ry={r * 0.42}
      fill={sunShadowFill(night)}
      style={{ mixBlendMode: "multiply" }}
    />
  );
}

function shadow(night: boolean) {
  return <GlyphSoftShadow night={night} />;
}

/** Canopy tree — lobed hand-wobbled circle + fine radial branching. */
export function CanopyTreeSymbol({
  itemId,
  tone,
}: {
  itemId: string;
  tone: SymbolTone;
}) {
  const rand = seededRandom(`canopy:${itemId}`);
  const path = wobbledCirclePath(50, 50, 44, rand, {
    segments: 28,
    amplitude: 0.028,
  });
  const branches = Array.from({ length: 9 }, (_, i) => {
    const a = ((i * 360) / 9 + rand() * 8) * (Math.PI / 180);
    const r1 = 6 + rand() * 4;
    const r2 = 28 + rand() * 12;
    return (
      <line
        key={i}
        x1={50 + r1 * Math.cos(a)}
        y1={50 + r1 * Math.sin(a)}
        x2={50 + r2 * Math.cos(a)}
        y2={50 + r2 * Math.sin(a)}
        stroke={tone.stroke}
        strokeWidth={0.55}
        opacity={0.55}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    );
  });
  return (
    <g
      opacity={tone.ghost ? 0.4 : 1}
      strokeDasharray={tone.ghost ? "3 2.5" : undefined}
    >
      <GlyphSoftShadow night={tone.night} />
      <path
        d={path}
        fill={tone.fill}
        stroke={tone.stroke}
        strokeWidth={0.4}
        vectorEffect="non-scaling-stroke"
      />
      {branches}
      <circle cx={50} cy={50} r={2.2} fill={tone.stroke} />
    </g>
  );
}

/** Pleached hornbeam — square head + stem dot (row-repeatable). */
export function PleachedHornbeamSymbol({
  itemId,
  tone,
}: {
  itemId: string;
  tone: SymbolTone;
}) {
  const rand = seededRandom(`pleach:${itemId}`);
  const j = () => (rand() * 2 - 1) * 1.2;
  return (
    <g
      opacity={tone.ghost ? 0.4 : 1}
      strokeDasharray={tone.ghost ? "3 2.5" : undefined}
    >
      <GlyphSoftShadow night={tone.night} />
      <rect
        x={22 + j()}
        y={18 + j()}
        width={56}
        height={48}
        rx={4}
        fill={tone.fill}
        stroke={tone.stroke}
        strokeWidth={0.4}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={50} cy={78} r={2.4} fill={tone.stroke} />
      <line
        x1={50}
        y1={66}
        x2={50}
        y2={76}
        stroke={tone.stroke}
        strokeWidth={0.55}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

/** Hedge — continuous band with cross-ticks. */
export function HedgeSymbol({
  itemId,
  tone,
}: {
  itemId: string;
  tone: SymbolTone;
}) {
  const rand = seededRandom(`hedge:${itemId}`);
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const x = 10 + i * 8 + (rand() * 2 - 1) * 0.6;
    return (
      <line
        key={i}
        x1={x}
        y1={38}
        x2={x}
        y2={62}
        stroke={tone.stroke}
        strokeWidth={0.45}
        opacity={0.7}
        vectorEffect="non-scaling-stroke"
      />
    );
  });
  return (
    <g
      opacity={tone.ghost ? 0.4 : 1}
      strokeDasharray={tone.ghost ? "3 2.5" : undefined}
    >
      <GlyphSoftShadow night={tone.night} />
      <rect
        x={6}
        y={36}
        width={88}
        height={28}
        rx={5}
        fill={tone.fill}
        stroke={tone.stroke}
        strokeWidth={0.4}
        vectorEffect="non-scaling-stroke"
      />
      {ticks}
    </g>
  );
}

/** Mass planting drift — stippled outline, reads as one mass. */
export function MassPlantingSymbol({
  itemId,
  tone,
}: {
  itemId: string;
  tone: SymbolTone;
}) {
  const rand = seededRandom(`bed:${itemId}`);
  const path = wobbledCirclePath(50, 50, 42, rand, {
    segments: 20,
    amplitude: 0.03,
  });
  // Stretch to ellipse-ish via transform on a group — keep path circular then scale Y.
  const dots = Array.from({ length: 18 }, (_, i) => {
    const a = rand() * Math.PI * 2;
    const rr = 8 + rand() * 28;
    return (
      <circle
        key={i}
        cx={50 + rr * Math.cos(a)}
        cy={50 + rr * Math.sin(a) * 0.72}
        r={1.1 + rand() * 0.8}
        fill={tone.stroke}
        opacity={0.35 + rand() * 0.25}
      />
    );
  });
  return (
    <g
      opacity={tone.ghost ? 0.4 : 1}
      strokeDasharray={tone.ghost ? "3 2.5" : undefined}
    >
      <GlyphSoftShadow night={tone.night} />
      <g transform="translate(50 50) scale(1 0.72) translate(-50 -50)">
        <path
          d={path}
          fill={tone.fill}
          stroke={tone.stroke}
          strokeWidth={0.4}
          vectorEffect="non-scaling-stroke"
        />
      </g>
      {dots}
    </g>
  );
}

/** Feature / Cycas — spiky rosette. */
export function FeatureCycasSymbol({
  itemId,
  tone,
}: {
  itemId: string;
  tone: SymbolTone;
}) {
  const rand = seededRandom(`cycas:${itemId}`);
  const spikes = Array.from({ length: 14 }, (_, i) => {
    const a = ((i / 14) * 360 + (rand() * 2 - 1) * 4) * (Math.PI / 180);
    const r1 = 5;
    const r2 = 38 + rand() * 6;
    return (
      <line
        key={i}
        x1={50 + r1 * Math.cos(a)}
        y1={50 + r1 * Math.sin(a)}
        x2={50 + r2 * Math.cos(a)}
        y2={50 + r2 * Math.sin(a)}
        stroke={tone.stroke}
        strokeWidth={0.7}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    );
  });
  return (
    <g
      opacity={tone.ghost ? 0.4 : 1}
      strokeDasharray={tone.ghost ? "3 2.5" : undefined}
    >
      <GlyphSoftShadow night={tone.night} />
      <circle
        cx={50}
        cy={50}
        r={12}
        fill={tone.fill}
        stroke={tone.stroke}
        strokeWidth={0.4}
        vectorEffect="non-scaling-stroke"
      />
      {spikes}
      <circle cx={50} cy={50} r={2.6} fill={tone.stroke} />
    </g>
  );
}

/** Existing tree — fine dashed outline + trunk (line ladder existing). */
export function ExistingTreeSymbol({
  itemId,
  tone,
}: {
  itemId: string;
  tone: SymbolTone;
}) {
  const rand = seededRandom(`exist:${itemId}`);
  const path = wobbledCirclePath(50, 50, 44, rand, {
    segments: 22,
    amplitude: 0.02,
  });
  return (
    <g opacity={tone.ghost ? 0.4 : 1}>
      <GlyphSoftShadow night={tone.night} />
      <path
        d={path}
        fill="none"
        stroke={tone.stroke}
        strokeWidth={0.4}
        strokeDasharray="2.5 2"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={50} cy={50} r={2.4} fill={tone.stroke} />
      <line
        x1={42}
        y1={50}
        x2={58}
        y2={50}
        stroke={tone.stroke}
        strokeWidth={0.4}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={50}
        y1={42}
        x2={50}
        y2={58}
        stroke={tone.stroke}
        strokeWidth={0.4}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}
