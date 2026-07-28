"use client";

import {
  fixtureBeamDeg,
  isLightingSymbolId,
  kelvinToCss,
} from "@workstream/domain";
import type { StudioItem } from "../../studioCatalog";
import css from "./lightingBeams.module.css";

type Props = {
  items: StudioItem[];
  kelvin: number;
  active: boolean;
};

/**
 * Indicative photometric cones for placed lighting fixtures.
 * Render-only; engineering lives in lv-lighting assessment.
 */
export function LightingBeams({ items, kelvin, active }: Props) {
  if (!active) return null;
  const fixtures = items.filter(
    (i) => !i.ghost && i.symbolId && isLightingSymbolId(i.symbolId),
  );
  if (fixtures.length === 0) return null;

  const fill = kelvinToCss(kelvin);

  return (
    <svg
      className={css.svg}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      data-testid="lighting-beams"
    >
      {fixtures.map((f) => {
        const beam = fixtureBeamDeg(f.symbolId!);
        const half = beam / 2;
        const rot = f.rot ?? 0;
        // Aim "up" the glyph (negative Y) then rotate by fixture rot.
        const reach = Math.min(8, 2.2 + beam / 18);
        const a0 = ((-90 - half + rot) * Math.PI) / 180;
        const a1 = ((-90 + half + rot) * Math.PI) / 180;
        const x0 = f.x + Math.cos(a0) * reach;
        const y0 = f.y + Math.sin(a0) * reach;
        const x1 = f.x + Math.cos(a1) * reach;
        const y1 = f.y + Math.sin(a1) * reach;
        return (
          <path
            key={f.id}
            className={css.cone}
            data-testid="lighting-beam-cone"
            d={`M ${f.x.toFixed(2)} ${f.y.toFixed(2)} L ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} Z`}
            fill={fill}
          />
        );
      })}
    </svg>
  );
}
