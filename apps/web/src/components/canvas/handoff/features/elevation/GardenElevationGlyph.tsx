"use client";

import type { ReactNode } from "react";
import type { GardenAssetFamily } from "@workstream/domain";
import type { StudioItem } from "../../studioCatalog";
import {
  resolveItemFamily,
  resolveItemHeightM,
} from "../../geometry/itemHeight";
import {
  SEMANTIC_DARK,
  SEMANTIC_LIGHT,
  mixOnHex,
} from "../../../../../styles/colorTokens";
import { elevationTextureUrl } from "../render/renderTokens";
import {
  deckElevGeometry,
  hasGardenSilhouette,
  hedgeElevGeometry,
  screenElevGeometry,
  shrubElevGeometry,
  treeElevGeometry,
  type ElevBox,
} from "./gardenElevationGeometry";

/**
 * Orthographic garden silhouette for one elevation bar.
 *
 * Renders a `<g>` to be placed inside the elevation SVG — the caller owns the
 * bar box, this owns what the asset looks like standing on the ground line.
 * Families come from the Tier 2 resolvers (`resolveItemFamily`), heights from
 * `resolveItemHeightM`, so a placed 7.8 m tree draws as a 7.8 m tree.
 *
 * Structures and fixtures resolve to a null family and keep the plain
 * rectangular profile the board has always drawn — a retaining wall must not
 * sprout a canopy.
 *
 * Texture note: when `textured` is on, the caller must have mounted
 * `ElevationTextureDefs` in the same SVG. A flat token wash is painted under
 * every textured shape, so a missing def degrades to a solid silhouette
 * rather than an invisible one.
 */

/** Named stroke weights — viewBox units, paired with non-scaling-stroke. */
const ELEV_STROKE = {
  outline: 0.55,
  outlineSelected: 0.9,
  detail: 0.32,
  trunk: 0.5,
} as const;

const GHOST_DASH = "1.5 1.2";
const GHOST_OPACITY = 0.55;

type Props = {
  family: GardenAssetFamily | null;
  box: ElevBox;
  /** Night lens — elevation joins the dark board. */
  night?: boolean;
  ghost?: boolean;
  selected?: boolean;
  /** Paint material texture over the flat wash (needs ElevationTextureDefs). */
  textured?: boolean;
};

function paintFor(night: boolean) {
  const s = night ? SEMANTIC_DARK : SEMANTIC_LIGHT;
  return {
    foliageFill: mixOnHex(s.plantingNewStroke, 18, s.canvas),
    foliageEdge: mixOnHex(s.plantingRetainStroke, 75, s.canvas),
    hedgeFill: mixOnHex(s.hedge, 22, s.canvas),
    hedgeEdge: mixOnHex(s.hedge, 80, s.canvas),
    timberFill: mixOnHex(s.timber, 22, s.canvas),
    timberEdge: mixOnHex(s.timber, 80, s.canvas),
    trunk: mixOnHex(s.timber, 70, s.canvas),
    plainFill: mixOnHex(s.textPrimary, 10, s.canvas),
    plainEdge: s.textPrimary,
  };
}

export function GardenElevationGlyph({
  family,
  box,
  night = false,
  ghost = false,
  selected = false,
  textured = false,
}: Props) {
  const ink = paintFor(night);
  const outlineW = selected ? ELEV_STROKE.outlineSelected : ELEV_STROKE.outline;
  const dash = ghost ? GHOST_DASH : undefined;
  const opacity = ghost ? GHOST_OPACITY : 1;
  const stroke = (edge: string) => (ghost ? ink.plainEdge : edge);

  const shell = (children: ReactNode) => (
    <g
      data-elev-family={family ?? "plain"}
      data-textured={textured ? "1" : "0"}
      opacity={opacity}
    >
      {children}
    </g>
  );

  if (!hasGardenSilhouette(family)) {
    // Structures / fixtures — the plain profile, unchanged.
    return shell(
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        fill={ink.plainFill}
        stroke={stroke(ink.plainEdge)}
        strokeWidth={outlineW}
        strokeDasharray={dash}
        vectorEffect="non-scaling-stroke"
      />,
    );
  }

  if (family === "tree") {
    const g = treeElevGeometry(box);
    return shell(
      <>
        <line
          x1={g.centreX}
          y1={g.groundY}
          x2={g.centreX}
          y2={g.trunkTopY}
          stroke={stroke(ink.trunk)}
          strokeWidth={ELEV_STROKE.trunk}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx={g.crownCx}
          cy={g.crownCy}
          rx={g.crownRx}
          ry={g.crownRy}
          fill={ink.foliageFill}
          stroke={stroke(ink.foliageEdge)}
          strokeWidth={outlineW}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
        {textured && !ghost ? (
          <ellipse
            cx={g.crownCx}
            cy={g.crownCy}
            rx={g.crownRx}
            ry={g.crownRy}
            fill={elevationTextureUrl("foliage", night)}
            stroke="none"
          />
        ) : null}
      </>,
    );
  }

  if (family === "screen") {
    const g = screenElevGeometry(box);
    return shell(
      <>
        <line
          x1={g.centreX}
          y1={g.groundY}
          x2={g.centreX}
          y2={g.stemTopY}
          stroke={stroke(ink.trunk)}
          strokeWidth={ELEV_STROKE.trunk}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
        <rect
          x={g.panel.x}
          y={g.panel.y}
          width={g.panel.w}
          height={g.panel.h}
          fill={ink.foliageFill}
          stroke={stroke(ink.foliageEdge)}
          strokeWidth={outlineW}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
        {textured && !ghost ? (
          <rect
            x={g.panel.x}
            y={g.panel.y}
            width={g.panel.w}
            height={g.panel.h}
            fill={elevationTextureUrl("foliage", night)}
            stroke="none"
          />
        ) : null}
      </>,
    );
  }

  if (family === "hedge") {
    const g = hedgeElevGeometry(box);
    return shell(
      <>
        <rect
          x={g.block.x}
          y={g.block.y}
          width={g.block.w}
          height={g.block.h}
          fill={ink.hedgeFill}
          stroke={stroke(ink.hedgeEdge)}
          strokeWidth={outlineW}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
        {textured && !ghost ? (
          <rect
            x={g.block.x}
            y={g.block.y}
            width={g.block.w}
            height={g.block.h}
            fill={elevationTextureUrl("clip", night)}
            stroke="none"
          />
        ) : null}
        {ghost
          ? null
          : g.tickXs.map((tx, i) => (
            <circle
              key={`clip-${i}`}
              cx={tx}
              cy={g.block.y}
              r={g.tickR}
              fill="none"
              stroke={ink.hedgeEdge}
              strokeWidth={ELEV_STROKE.detail}
              vectorEffect="non-scaling-stroke"
            />
          ))}
      </>,
    );
  }

  if (family === "shrub") {
    const g = shrubElevGeometry(box);
    return shell(
      <>
        <ellipse
          cx={g.centreX}
          cy={g.cy}
          rx={g.rx}
          ry={g.ry}
          fill={ink.foliageFill}
          stroke={stroke(ink.foliageEdge)}
          strokeWidth={outlineW}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
        {textured && !ghost ? (
          <ellipse
            cx={g.centreX}
            cy={g.cy}
            rx={g.rx}
            ry={g.ry}
            fill={elevationTextureUrl("foliage", night)}
            stroke="none"
          />
        ) : null}
      </>,
    );
  }

  const g = deckElevGeometry(box);
  return shell(
    <>
      {g.postXs.map((px, i) => (
        <line
          key={`post-${i}`}
          x1={px}
          y1={g.postTopY}
          x2={px}
          y2={g.groundY}
          stroke={stroke(ink.timberEdge)}
          strokeWidth={ELEV_STROKE.trunk}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <rect
        x={g.plate.x}
        y={g.plate.y}
        width={g.plate.w}
        height={g.plate.h}
        fill={ink.timberFill}
        stroke={stroke(ink.timberEdge)}
        strokeWidth={outlineW}
        strokeDasharray={dash}
        vectorEffect="non-scaling-stroke"
      />
      {textured && !ghost ? (
        <rect
          x={g.plate.x}
          y={g.plate.y}
          width={g.plate.w}
          height={g.plate.h}
          fill={elevationTextureUrl("timber", night)}
          stroke="none"
        />
      ) : null}
      <rect
        x={g.fascia.x}
        y={g.fascia.y}
        width={g.fascia.w}
        height={g.fascia.h}
        fill={ink.timberEdge}
        stroke="none"
        opacity={ghost ? GHOST_OPACITY : 0.85}
      />
    </>,
  );
}

/**
 * Bar-agnostic props for a placed item — heights and family straight off the
 * Tier 2 resolvers. The caller still owns x / width (that is projection), this
 * owns how tall it stands and what it looks like.
 */
export function gardenGlyphPropsForItem(item: StudioItem): {
  family: GardenAssetFamily | null;
  heightM: number;
  ghost: boolean;
} {
  return {
    family: resolveItemFamily(item),
    heightM: resolveItemHeightM(item),
    ghost: item.ghost,
  };
}
