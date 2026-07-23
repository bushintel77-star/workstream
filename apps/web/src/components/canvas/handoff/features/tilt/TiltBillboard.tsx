"use client";

import type { StudioItem, StudioItemType } from "../../studioCatalog";
import { BY_TYPE } from "../../studioCatalog";
import { StudioGlyph } from "../../StudioGlyph";
import { billboardStyle } from "./tiltMath";
import css from "./tilt.module.css";

type Props = {
  item: StudioItem;
  ppm: number;
  tiltDeg: number;
  ink: boolean;
};

/**
 * Standing sprite for planted items with height — plan glyph stays as a
 * dimmed footprint; the face counters the world rotateX so it reads upright.
 */
export function TiltBillboard({ item, ppm, tiltDeg, ink }: Props) {
  const d = BY_TYPE[item.t as StudioItemType];
  const heightM = d?.heightM ?? 0;
  if (heightM <= 0 || tiltDeg < 0.5) return null;
  const face = billboardStyle(heightM, ppm, tiltDeg);
  const footprintW = Math.max(12, Math.round((d?.w ?? 24) * item.scale));
  const footprintH = Math.max(10, Math.round((d?.h ?? 20) * item.scale));

  return (
    <div
      className={css.billboard}
      data-testid="tilt-billboard"
      data-plan-geometry="1"
      data-item-id={item.id}
      style={{ left: `${item.x}%`, top: `${item.y}%` }}
      aria-hidden
    >
      <div className={css.baseShadow} />
      <div
        className={css.footprint}
        style={{ width: footprintW, height: footprintH }}
      >
        <StudioGlyph type={item.t} ink={ink} />
      </div>
      <div className={css.billboardFace} style={face}>
        <StudioGlyph type={item.t} ink={ink} />
      </div>
    </div>
  );
}
