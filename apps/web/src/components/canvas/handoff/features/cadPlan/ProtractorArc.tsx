import type { CSSProperties } from "react";
import css from "./cadPlan.module.css";

export function nearestProtractorTick(angleDeg: number): number {
  return ((Math.round(angleDeg / 15) * 15) % 360 + 360) % 360;
}

type Props = {
  angleDeg: number;
  radiusPx: number;
  itemRotationDeg: number;
  shiftHeld: boolean;
};

export function ProtractorArc({
  angleDeg,
  radiusPx,
  itemRotationDeg,
  shiftHeld,
}: Props) {
  const size = Math.max(72, radiusPx * 2);
  const centre = size / 2;
  const radius = centre - 7;
  const active = nearestProtractorTick(angleDeg);
  return (
    <svg
      className={css.protractorArc}
      data-testid="selection-protractor"
      data-shift={shiftHeld ? "true" : "false"}
      viewBox={`0 0 ${size} ${size}`}
      style={
        {
          width: size,
          height: size,
          transform: `translate(-50%, -50%) rotate(${-itemRotationDeg}deg) scale(calc(1 / var(--studio-zoom, 1)))`,
        } as CSSProperties
      }
      aria-hidden
    >
      <circle cx={centre} cy={centre} r={radius} className={css.protractorRing} />
      {Array.from({ length: 24 }, (_, index) => {
        const degrees = index * 15;
        const radians = ((degrees - 90) * Math.PI) / 180;
        const major = degrees % 45 === 0;
        const outerX = centre + radius * Math.cos(radians);
        const outerY = centre + radius * Math.sin(radians);
        const innerRadius = radius - (major ? 7 : 4);
        const innerX = centre + innerRadius * Math.cos(radians);
        const innerY = centre + innerRadius * Math.sin(radians);
        const highlighted = shiftHeld && degrees === active;
        return (
          <line
            key={degrees}
            x1={innerX}
            y1={innerY}
            x2={outerX}
            y2={outerY}
            className={
              highlighted ? css.protractorTickActive : css.protractorTick
            }
          />
        );
      })}
    </svg>
  );
}
