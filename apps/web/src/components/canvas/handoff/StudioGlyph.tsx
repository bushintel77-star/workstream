import type { ReactNode } from "react";
import type { StudioItemType } from "./studioCatalog";

/**
 * Plan symbols — clean, modern landscape-CAD language on the blush field.
 *
 * Design intent (2026, not old dirty CAD): thin consistent strokes, soft
 * on-palette tones, light airy hatching, generous negative space. Type reads
 * at a glance (stone grid ≠ timber plank ≠ softscape stipple ≠ drain dots)
 * without heavy near-black ink or muddy dense fills.
 */
export function StudioGlyph({
  type,
  ink = false,
}: {
  type: StudioItemType;
  ink?: boolean;
}) {
  // Soft, refined palette — muted, never near-black or neon.
  const LINE = ink ? "#5A4650" : "#6E5A62";
  const GREEN = ink ? "#6E8B63" : "#7A9670";
  const GREEN_DEEP = ink ? "#557049" : "#5F7A50";
  const STONE = ink ? "#8C8B93" : "#9A9AA0";
  const TIMBER = ink ? "#B58A5E" : "#C09468";
  const WATER = ink ? "#6C8598" : "#7C97AB";
  const softHatch = "rgba(94, 70, 80, 0.22)";
  const greenFill = "rgba(122, 150, 112, 0.14)";
  const stoneFill = "rgba(150, 150, 158, 0.12)";
  const timberFill = "rgba(192, 148, 104, 0.12)";
  const airFill = "rgba(122, 150, 112, 0.07)";

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
          strokeWidth={0.9}
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
            strokeWidth={1.1}
            fill={greenFill}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={50}
            cy={50}
            r={30}
            stroke={GREEN}
            strokeWidth={0.7}
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
            strokeWidth={1.1}
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
            strokeWidth={1.15}
            fill={stoneFill}
            vectorEffect="non-scaling-stroke"
          />
          {/* Clean ashlar coursing — thin, airy, offset joints. */}
          {[33, 61].map((y) => (
            <line
              key={y}
              x1={5}
              y1={y}
              x2={95}
              y2={y}
              stroke={softHatch}
              strokeWidth={0.7}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {[38, 68].map((x) => (
            <line
              key={`a${x}`}
              x1={x}
              y1={7}
              x2={x}
              y2={33}
              stroke={softHatch}
              strokeWidth={0.7}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {[24, 52, 80].map((x) => (
            <line
              key={`b${x}`}
              x1={x}
              y1={33}
              x2={x}
              y2={61}
              stroke={softHatch}
              strokeWidth={0.7}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {[38, 68].map((x) => (
            <line
              key={`c${x}`}
              x1={x}
              y1={61}
              x2={x}
              y2={93}
              stroke={softHatch}
              strokeWidth={0.7}
              vectorEffect="non-scaling-stroke"
            />
          ))}
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
            strokeWidth={1.2}
            fill={timberFill}
            vectorEffect="non-scaling-stroke"
          />
          {Array.from({ length: 7 }, (_, i) => (
            <line
              key={i}
              x1={5}
              y1={19 + i * 11}
              x2={95}
              y2={19 + i * 11}
              stroke="rgba(176, 138, 94, 0.5)"
              strokeWidth={0.9}
              vectorEffect="non-scaling-stroke"
            />
          ))}
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
            strokeWidth={0.9}
            fill={airFill}
            strokeDasharray="3 3.5"
            vectorEffect="non-scaling-stroke"
          />
          {/* Fine even stipple — reads as mown turf, not scribble. */}
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
          {/* Clipped hedge — clean scalloped cloud, airy fill. */}
          <rect
            x={4}
            y={30}
            width={92}
            height={40}
            rx={6}
            stroke={GREEN_DEEP}
            strokeWidth={1.1}
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
              strokeWidth={0.75}
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
              strokeWidth={0.75}
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
            strokeWidth={1}
            fill={greenFill}
            vectorEffect="non-scaling-stroke"
          />
          {/* Mass-planting dots — soft, evenly scattered. */}
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
              strokeWidth={0.7}
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
            strokeWidth={1.4}
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
            strokeWidth={1.1}
            fill="none"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={50}
            cy={50}
            r={29}
            stroke="rgba(232,184,75,0.85)"
            strokeWidth={1}
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
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={50}
            y1={40}
            x2={50}
            y2={60}
            stroke={LINE}
            strokeWidth={1}
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
      {children}
    </svg>
  );
}
