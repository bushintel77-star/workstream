import type { GardenAssetFamily } from "@workstream/domain";

/**
 * Orthographic elevation silhouette geometry, per garden asset family.
 *
 * Pure maths in the caller's own units (the elevation board works in its
 * `0 0 100 40` viewBox). Every shape is anchored to the ground line at
 * `box.y + box.h` and stays inside the box — a profile that floats above the
 * datum or grows out of its bar is the classic elevation bug, so the invariants
 * are asserted in `gardenElevationGeometry.test.ts`.
 *
 * Note: the elevation board stretches its viewBox (`preserveAspectRatio="none"`),
 * so circular forms render as mild ellipses. Radii are expressed separately
 * (`rx` / `ry`) so a caller can compensate if it ever needs to.
 */

export type ElevBox = { x: number; y: number; w: number; h: number };

/** Share of total height taken by a tree's clear stem. */
const TREE_TRUNK_FRACTION = 0.34;
/** Share of total height taken by a pleached screen's clear stem. */
const SCREEN_STEM_FRACTION = 0.45;
/** Share of a deck's height that is plate + fascia (rest is posts). */
const DECK_PLATE_FRACTION = 0.6;
/** Trunk width as a share of bar width, and its floor. */
const TRUNK_WIDTH_FRACTION = 0.18;
const TRUNK_WIDTH_MIN = 0.25;
/** Hedge clip ticks along the cut line. */
const HEDGE_TICK_COUNT = 4;

export type TreeElevGeometry = {
  groundY: number;
  centreX: number;
  trunkTopY: number;
  trunkW: number;
  crownCx: number;
  crownCy: number;
  crownRx: number;
  crownRy: number;
  crownTopY: number;
};

export type ScreenElevGeometry = {
  groundY: number;
  centreX: number;
  stemTopY: number;
  stemW: number;
  panel: ElevBox;
};

export type HedgeElevGeometry = {
  groundY: number;
  block: ElevBox;
  /** X positions of the clip ticks along the top edge. */
  tickXs: number[];
  tickR: number;
  /** Y of the interior clip line (reads as a maintained face). */
  clipLineY: number;
};

export type ShrubElevGeometry = {
  groundY: number;
  centreX: number;
  cy: number;
  rx: number;
  ry: number;
};

export type DeckElevGeometry = {
  groundY: number;
  plate: ElevBox;
  fascia: ElevBox;
  /** X centres of the two visible posts. */
  postXs: number[];
  postW: number;
  postTopY: number;
  /** Y positions of the board joints drawn across the plate. */
  boardYs: number[];
};

function safeBox(box: ElevBox): ElevBox {
  return {
    x: box.x,
    y: box.y,
    w: Math.max(0, box.w),
    h: Math.max(0, box.h),
  };
}

function trunkWidth(w: number): number {
  return Math.max(Math.min(TRUNK_WIDTH_MIN, w), w * TRUNK_WIDTH_FRACTION);
}

export function treeElevGeometry(input: ElevBox): TreeElevGeometry {
  const box = safeBox(input);
  const groundY = box.y + box.h;
  const centreX = box.x + box.w / 2;
  const trunkH = box.h * TREE_TRUNK_FRACTION;
  const trunkTopY = groundY - trunkH;
  const crownRy = (box.h - trunkH) / 2;
  return {
    groundY,
    centreX,
    trunkTopY,
    trunkW: trunkWidth(box.w),
    crownCx: centreX,
    crownCy: trunkTopY - crownRy,
    crownRx: box.w / 2,
    crownRy,
    crownTopY: box.y,
  };
}

export function screenElevGeometry(input: ElevBox): ScreenElevGeometry {
  const box = safeBox(input);
  const groundY = box.y + box.h;
  const stemH = box.h * SCREEN_STEM_FRACTION;
  const stemTopY = groundY - stemH;
  return {
    groundY,
    centreX: box.x + box.w / 2,
    stemTopY,
    stemW: trunkWidth(box.w),
    panel: { x: box.x, y: box.y, w: box.w, h: box.h - stemH },
  };
}

export function hedgeElevGeometry(input: ElevBox): HedgeElevGeometry {
  const box = safeBox(input);
  const groundY = box.y + box.h;
  const step = box.w / (HEDGE_TICK_COUNT + 1);
  return {
    groundY,
    block: box,
    tickXs: Array.from(
      { length: HEDGE_TICK_COUNT },
      (_, i) => box.x + step * (i + 1),
    ),
    tickR: Math.min(step / 2, box.h * 0.12),
    clipLineY: box.y + box.h * 0.45,
  };
}

export function shrubElevGeometry(input: ElevBox): ShrubElevGeometry {
  const box = safeBox(input);
  const groundY = box.y + box.h;
  return {
    groundY,
    centreX: box.x + box.w / 2,
    cy: groundY,
    rx: box.w / 2,
    ry: box.h,
  };
}

export function deckElevGeometry(input: ElevBox): DeckElevGeometry {
  const box = safeBox(input);
  const groundY = box.y + box.h;
  const plateH = box.h * DECK_PLATE_FRACTION;
  const fasciaH = plateH * 0.35;
  const deckTopH = plateH - fasciaH;
  const fasciaY = box.y + deckTopH;
  const postTopY = box.y + plateH;
  const postW = Math.max(TRUNK_WIDTH_MIN, box.w * 0.08);
  const inset = box.w * 0.18;
  return {
    groundY,
    plate: { x: box.x, y: box.y, w: box.w, h: deckTopH },
    fascia: { x: box.x, y: fasciaY, w: box.w, h: fasciaH },
    postXs: [box.x + inset, box.x + box.w - inset],
    postW,
    postTopY,
    boardYs: [box.y + deckTopH * 0.34, box.y + deckTopH * 0.68],
  };
}

/**
 * Families that draw a distinct silhouette. Anything else (structures,
 * fixtures) keeps the plain rectangular profile the board already used.
 */
export function hasGardenSilhouette(
  family: GardenAssetFamily | null | undefined,
): family is GardenAssetFamily {
  return (
    family === "tree" ||
    family === "screen" ||
    family === "hedge" ||
    family === "shrub" ||
    family === "deck"
  );
}


