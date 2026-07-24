import { describe, expect, it } from "vitest";
import { applyAutoTraceParcelSnap, applyParcelSnap } from "./parcelHydrate";
import { fitCanvasMetresRing } from "./geoToPct";
import type { PctPoint } from "./types";

const SEED_BOUNDARY: PctPoint[] = [
  { x: 36, y: 10 },
  { x: 42.5, y: 10.6 },
  { x: 40.6, y: 90 },
  { x: 34, y: 89.2 },
];

/** Demo Wrights dwelling — must never survive a Vicmap parcel snap. */
const SEED_BUILDING: PctPoint[] = [
  { x: 36.6, y: 22 },
  { x: 41.9, y: 22.4 },
  { x: 41.1, y: 52 },
  { x: 35.8, y: 51.6 },
];

describe("applyParcelSnap", () => {
  const parcelM = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 25 },
    { x: 0, y: 25 },
  ];
  const houseM = [
    { x: 8, y: 6 },
    { x: 22, y: 6 },
    { x: 22, y: 16 },
    { x: 8, y: 16 },
  ];

  it("hydrates Vicmap house and clears the seed dwelling", () => {
    const fit = fitCanvasMetresRing(parcelM);
    const result = applyParcelSnap({
      snap: {
        boundary: SEED_BOUNDARY,
        building: SEED_BUILDING,
        items: [],
        strokes: [],
      },
      nextBoundary: fit.points,
      houseCanvasVerts: houseM,
      transform: fit.transform,
      keepTracedBuilding: false,
    });
    expect(result.buildingSource).toBe("vicmap");
    expect(result.snap.building).toHaveLength(4);
    // Must not be a bbox-warp of the seed parallelogram.
    const seedLike = result.snap.building.every((p, i) => {
      const s = SEED_BUILDING[i]!;
      return Math.abs(p.x - s.x) < 2 && Math.abs(p.y - s.y) < 2;
    });
    expect(seedLike).toBe(false);
  });

  it("clears dwelling when Vicmap has no house", () => {
    const fit = fitCanvasMetresRing(parcelM);
    const result = applyParcelSnap({
      snap: {
        boundary: SEED_BOUNDARY,
        building: SEED_BUILDING,
        items: [],
        strokes: [],
      },
      nextBoundary: fit.points,
      houseCanvasVerts: [],
      transform: fit.transform,
      keepTracedBuilding: false,
    });
    expect(result.buildingSource).toBe("empty");
    expect(result.snap.building).toEqual([]);
  });

  it("keeps an operator-traced dwelling across parcel snap", () => {
    const fit = fitCanvasMetresRing(parcelM);
    const traced: PctPoint[] = [
      { x: 38, y: 30 },
      { x: 40, y: 30 },
      { x: 40, y: 40 },
      { x: 38, y: 40 },
    ];
    const result = applyParcelSnap({
      snap: {
        boundary: SEED_BOUNDARY,
        building: traced,
        items: [],
        strokes: [],
      },
      nextBoundary: fit.points,
      houseCanvasVerts: houseM,
      transform: fit.transform,
      keepTracedBuilding: true,
    });
    expect(result.buildingSource).toBe("traced");
    expect(result.snap.building).toHaveLength(4);
  });
});

describe("applyAutoTraceParcelSnap easement hydrate", () => {
  const parcelM = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 25 },
    { x: 0, y: 25 },
  ];

  it("hydrates Vicmap easement lines onto empty services", () => {
    const result = applyAutoTraceParcelSnap({
      snap: {
        boundary: SEED_BOUNDARY,
        building: [],
        items: [],
        strokes: [],
        services: [],
      },
      res: {
        boundary: {
          source_kind: "vicmap",
          vertices: parcelM.map((v, i) => ({
            sequence_index: i,
            canvas_coords: v,
          })),
        },
        building_canvas: [],
        building_source: null,
        easement_lines_canvas: [
          {
            points: [
              { x: 5, y: 5 },
              { x: 35, y: 20 },
            ],
            pfi: "353608",
          },
        ],
        easement_source: "vicmap",
      },
      keepTracedBuilding: false,
    });
    expect(result).not.toBeNull();
    expect(result!.easementSource).toBe("vicmap");
    expect(result!.services).toHaveLength(1);
    expect(result!.services![0]!.length).toBe(2);
  });

  it("keeps operator-authored services over Vicmap easement lines", () => {
    const authored = [
      [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
    ];
    const result = applyAutoTraceParcelSnap({
      snap: {
        boundary: SEED_BOUNDARY,
        building: [],
        items: [],
        strokes: [],
        services: authored,
      },
      res: {
        boundary: {
          source_kind: "vicmap",
          vertices: parcelM.map((v, i) => ({
            sequence_index: i,
            canvas_coords: v,
          })),
        },
        easement_lines_canvas: [
          {
            points: [
              { x: 5, y: 5 },
              { x: 35, y: 20 },
            ],
          },
        ],
        easement_source: "vicmap",
      },
      keepTracedBuilding: false,
    });
    expect(result!.services).toBeUndefined();
    expect(result!.easementSource).toBeUndefined();
  });
});
