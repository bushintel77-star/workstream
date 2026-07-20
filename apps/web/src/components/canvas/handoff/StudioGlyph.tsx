import type { ReactNode } from "react";
import type { StudioItemType } from "./studioCatalog";

/** Inline SVG plan symbols from Design Studio v4.dc.html `buildBlocks()`. */
export function StudioGlyph({
  type,
  ink = false,
}: {
  type: StudioItemType;
  ink?: boolean;
}) {
  /* Monograph parchment — charcoal vectors, muted olive hatch (no neon) */
  const W = ink ? "#1C1917" : "#3A322F";
  const G = ink ? "#4A5340" : "#5A6550";
  const DG = ink ? "#2F3528" : "#3D4636";
  const B = ink ? "#4A5560" : "#5C6570";
  const MV = ink ? "#5A4650" : "#6B5C60";
  const hatch = ink ? "rgba(28,25,23,0.45)" : "rgba(58,50,47,0.5)";
  const fillSoft = ink ? "rgba(28,25,23,0.06)" : "rgba(58,50,47,0.1)";

  const spokes = (n: number, r1: number, r2: number, s: string, off = 0) =>
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
          strokeWidth={1.2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    });

  const stretch = type === "paving" || type === "deck" || type === "lawn" || type === "hedge" || type === "bed" || type === "frenchdrain";

  let children: ReactNode = null;
  switch (type) {
    case "canopy":
      children = (
        <>
          <circle cx={50} cy={50} r={46} stroke={G} strokeWidth={1.2} fill={fillSoft} vectorEffect="non-scaling-stroke" />
          {spokes(12, 10, 43, hatch, 8)}
          <circle cx={50} cy={50} r={2.5} stroke={G} strokeWidth={1} fill={G} />
        </>
      );
      break;
    case "feature":
      children = (
        <>
          <circle cx={50} cy={50} r={46} stroke={W} strokeWidth={1.2} fill={fillSoft} vectorEffect="non-scaling-stroke" />
          {spokes(8, 12, 32, hatch, 22)}
          <line x1={44} y1={50} x2={56} y2={50} stroke={W} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          <line x1={50} y1={44} x2={50} y2={56} stroke={W} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        </>
      );
      break;
    case "paving":
      children = (
        <>
          <rect x={6} y={8} width={88} height={84} rx={1} stroke={W} strokeWidth={1.2} fill="rgba(120,118,110,0.18)" vectorEffect="non-scaling-stroke" />
          {[36, 64].map((y) => (
            <line key={y} x1={6} y1={y} x2={94} y2={y} stroke={hatch} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
          ))}
          {[35, 65].map((x) => (
            <line key={`a${x}`} x1={x} y1={8} x2={x} y2={36} stroke={hatch} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
          ))}
          {[20, 50, 80].map((x) => (
            <line key={`b${x}`} x1={x} y1={36} x2={x} y2={64} stroke={hatch} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
          ))}
          {[35, 65].map((x) => (
            <line key={`c${x}`} x1={x} y1={64} x2={x} y2={92} stroke={hatch} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
          ))}
        </>
      );
      break;
    case "deck":
      children = (
        <>
          <rect x={5} y={8} width={90} height={84} rx={2} stroke={MV} strokeWidth={1.4} fill="rgba(176,138,149,0.2)" vectorEffect="non-scaling-stroke" />
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i} x1={5} y1={17 + i * 9.5} x2={95} y2={17 + i * 9.5} stroke="rgba(226,214,218,0.75)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
        </>
      );
      break;
    case "lawn":
      children = (
        <>
          <rect x={5} y={8} width={90} height={84} rx={2} stroke={G} strokeWidth={1.1} fill={fillSoft} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          {[28, 53, 78].flatMap((y, r) =>
            [20, 35, 50, 65, 80].map((x) => (
              <line
                key={`${y}-${x}`}
                x1={x + (r % 2 ? 6 : 0)}
                y1={y}
                x2={x + (r % 2 ? 10 : 4)}
                y2={y - 9}
                stroke={hatch}
                strokeWidth={0.9}
                vectorEffect="non-scaling-stroke"
              />
            )),
          )}
        </>
      );
      break;
    case "hedge":
      children = (
        <>
          <rect x={4} y={26} width={92} height={48} rx={2} stroke={DG} strokeWidth={1.2} fill={fillSoft} vectorEffect="non-scaling-stroke" />
          {Array.from({ length: 11 }, (_, i) => (
            <circle key={`t${i}`} cx={9 + i * 8.2} cy={26} r={4} stroke={hatch} strokeWidth={0.9} fill="none" vectorEffect="non-scaling-stroke" />
          ))}
          {Array.from({ length: 11 }, (_, i) => (
            <circle key={`b${i}`} cx={9 + i * 8.2} cy={74} r={4} stroke={hatch} strokeWidth={0.9} fill="none" vectorEffect="non-scaling-stroke" />
          ))}
        </>
      );
      break;
    case "bed":
      children = (
        <>
          <ellipse cx={50} cy={50} rx={46} ry={34} stroke={G} strokeWidth={1.1} fill={fillSoft} vectorEffect="non-scaling-stroke" />
          {[-0.6, -0.3, 0, 0.3, 0.6].map((t) => {
            const cx = 50 + t * 40;
            const my = 30 * Math.sqrt(1 - t * t);
            return (
              <line
                key={t}
                x1={cx - 9}
                y1={50 + my * 0.75}
                x2={cx + 9}
                y2={50 - my * 0.75}
                stroke={hatch}
                strokeWidth={0.9}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </>
      );
      break;
    case "frenchdrain":
      children = (
        <>
          <line x1={6} y1={50} x2={94} y2={50} stroke={B} strokeWidth={1.8} strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={i} cx={10 + i * 10} cy={50} r={1.6} fill={B} stroke="none" />
          ))}
        </>
      );
      break;
    case "exist":
      children = (
        <>
          <circle cx={50} cy={50} r={44} stroke={W} strokeWidth={1.6} fill="none" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
          <circle cx={50} cy={50} r={30} stroke="rgba(232,184,75,0.9)" strokeWidth={1.2} fill="none" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <line x1={36} y1={50} x2={64} y2={50} stroke={W} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          <line x1={50} y1={36} x2={50} y2={64} stroke={W} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          <circle cx={50} cy={50} r={3} stroke={W} strokeWidth={1} fill={W} />
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
