"use client";

import type { StudioItem, StudioItemType } from "../../studioCatalog";
import { BY_TYPE } from "../../studioCatalog";
import { StudioGlyph } from "../../StudioGlyph";
import {
  hasElevationPresence,
  resolveItemFamily,
  resolveItemHeightGrownM,
  resolveItemSpreadGrownM,
} from "../../geometry/itemHeight";
import { GardenElevationGlyph } from "../elevation/GardenElevationGlyph";
import {
  SpeciesSymbol,
  isSpeciesSymbolType,
} from "../render/symbols/SpeciesSymbol";
import { billboardStyle } from "./tiltMath";
import css from "./tilt.module.css";

type Props = {
  item: StudioItem;
  ppm: number;
  tiltDeg: number;
  ink: boolean;
  /** Growth stage factor — existing trees are exempt inside the resolvers. */
  growth?: number;
};

/**
 * Standing sprite for planted items with height.
 *
 * The plan glyph stays as a dimmed footprint; the standing face is the *same
 * orthographic silhouette the elevation board draws* (tree on a trunk, pleached
 * panel on stems, deck on posts), sized at real spread × mature height, so the
 * tilt lens and the elevation agree. The face counters the world rotateX so it
 * reads upright.
 *
 * Untextured by design — `ElevationTextureDefs` is mounted once by the
 * elevation board, so the glyph's flat token wash is the tilt look.
 */
export function TiltBillboard({ item, ppm, tiltDeg, ink, growth = 1 }: Props) {
  const d = BY_TYPE[item.t as StudioItemType];
  if (!hasElevationPresence(item) || tiltDeg < 0.5) return null;
  const heightM = resolveItemHeightGrownM(item, growth);
  const face = billboardStyle(
    heightM,
    ppm,
    tiltDeg,
    resolveItemSpreadGrownM(item, growth),
  );
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
        {isSpeciesSymbolType(item.t) ? (
          <svg
            viewBox="0 0 100 100"
            width="100%"
            height="100%"
            overflow="visible"
            aria-hidden
            data-testid="tilt-billboard-species"
            data-symbol-type={item.t}
          >
            <SpeciesSymbol
              type={item.t}
              itemId={item.id}
              night={!ink}
              ghost={Boolean(item.ghost)}
              ink={ink}
              label={d?.name}
            />
          </svg>
        ) : (
          <StudioGlyph type={item.t} ink={ink} symbolId={item.symbolId} />
        )}
      </div>
      <div className={css.billboardFace} style={face}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          overflow="visible"
          data-elev-family={resolveItemFamily(item) ?? "plain"}
          aria-hidden
        >
          <GardenElevationGlyph
            family={resolveItemFamily(item)}
            box={{ x: 0, y: 0, w: 100, h: 100 }}
            night={!ink}
            ghost={item.ghost}
          />
        </svg>
      </div>
    </div>
  );
}
