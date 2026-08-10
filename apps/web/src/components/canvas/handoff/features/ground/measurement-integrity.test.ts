import { describe, expect, it } from "vitest";
import { polygonArea } from "@workstream/domain";
import { buildSiteSchedule } from "../../geometry/polygon";
import { fitCanvasMetresRing } from "../../geometry/geoToPct";
import {
  resolveSiteAreaDisplay,
  type FitSheetAreaDisplay,
} from "../../geometry/siteScheduleDisplay";
import { ZOOM_MIN } from "../../geometry/canvasZoom";
import {
  boardScaleM,
  pickMetricStepM,
  visibleMetres,
  visibleMetresFromScale,
} from "./groundMetrics";

/*
 * Measurement-integrity probe. Dimensions and areas are what a landscape
 * architect stakes professional liability on, and area drives the quote, so
 * the ruler, the dimension engine, and the lot-area label must all read the
 * SAME metres. This probe locks two invariants for any fitted parcel:
 *
 * 1. Ruler metres-per-percent == dimension engine metres-per-percent.
 *    The ruler must derive its scale from the fitted `boardWidthM`, not from a
 *    hardcoded 1:100 architectural denominator. On a rural parcel the hardcoded
 *    110 m board prints 10 m ticks while the boundary labels correctly read
 *    ~1600 m — two scales in one view.
 * 2. The displayed lot area agrees with the shoelace area of the drawn ring
 *    within a stated tolerance. The lot-area label may not silently quote a
 *    Vicmap whole-parcel figure while the drawn boundary (and its edge labels)
 *    describe a subset.
 */

const TOL_AREA_FRAC = 0.1; // 10% relative tolerance for area agreement.

/** Rural-ish rectangle in canvas metres: ~1600 x 680 m, area ~1.088M m^2. */
const RURAL_CANVAS_RING = [
  { x: 0, y: 0 },
  { x: 1600, y: 0 },
  { x: 1600, y: 680 },
  { x: 0, y: 680 },
];

/** Same rectangle expressed as a closed lat/lng ring near Melbourne. */
const RURAL_LNGLAT_RING = (() => {
  const mPerLat = 110_540;
  const mPerLng = 110_540 * Math.cos((-37.85 * Math.PI) / 180);
  const origin = { lng: 145.0, lat: -37.85 };
  const w = 1600 / mPerLng;
  const h = 680 / mPerLat;
  return [
    [origin.lng, origin.lat],
    [origin.lng + w, origin.lat],
    [origin.lng + w, origin.lat + h],
    [origin.lng, origin.lat + h],
    [origin.lng, origin.lat],
  ] as [number, number][];
})();

type FittedParcel = {
  boardWidthM: number;
  points: { x: number; y: number }[];
  drawnAreaM2: number;
  perimeterM: number;
};

function fitParcel(
  canvasRing: { x: number; y: number }[] = RURAL_CANVAS_RING,
): FittedParcel {
  const fit = fitCanvasMetresRing(canvasRing);
  if (!fit.boardWidthM || fit.points.length < 3) {
    throw new Error("degenerate fit");
  }
  const schedule = buildSiteSchedule(fit.points, [], fit.boardWidthM, 1);
  return {
    boardWidthM: fit.boardWidthM,
    points: fit.points,
    drawnAreaM2: schedule.lotAreaM2,
    perimeterM: schedule.boundaryPerimeterM,
  };
}

describe("measurement integrity: ruler scale == dimension engine scale", () => {
  it("uses the fitted boardWidthM, not a hardcoded 1:100 architectural scale", () => {
    const { boardWidthM } = fitParcel();
    // The dimension engine's metres-per-percent is boardWidthM/100.
    const dimensionScaleM = boardWidthM;
    // The ruler must read the same scale. After the fix it derives visible
    // metres from the live scaleM, not from boardScaleM(100)=110.
    const rulerVisibleM = visibleMetresFromScale(dimensionScaleM, 1);
    expect(rulerVisibleM).toBe(dimensionScaleM);
    // The hardcoded path that used to drive the ruler is a different scale on a
    // rural parcel — this is the bug the probe guards against regressing.
    expect(boardScaleM(100)).not.toBe(dimensionScaleM);
    expect(visibleMetres(100, 1)).toBe(110);
  });

  it("picks ruler ticks commensurate with the parcel, not 10 m on a 1.6 km lot", () => {
    const { boardWidthM } = fitParcel();
    const stepAfter = pickMetricStepM(visibleMetresFromScale(boardWidthM, 1));
    const stepBefore = pickMetricStepM(visibleMetres(100, 1));
    // Rural board ~1900 m across -> 100 m ticks. Hardcoded 110 m board -> 10 m.
    expect(stepAfter).toBeGreaterThanOrEqual(50);
    expect(stepBefore).toBe(10);
  });

  it("clamps zoom at ZOOM_MIN so a degenerate zoom never divides by zero", () => {
    const { boardWidthM } = fitParcel();
    expect(visibleMetresFromScale(boardWidthM, 0)).toBe(
      boardWidthM / ZOOM_MIN,
    );
  });
});

describe("measurement integrity: TactileGround mesh + chip read the fitted scale", () => {
  /*
   * TactileGround used to derive its mesh density and "1:100" chip copy from a
   * hardcoded `boardScaleM(100)=110 m`, so on a rural parcel the mesh grid
   * showed 10 m cells while the boundary labels correctly read ~1600 m. After
   * the fix it accepts a live `scaleM` (the fitted `boardWidthM`) and the mesh
   * step + chip follow it, matching the ruler and dimension engine. The Fit
   * sheet still passes `sheetScaleDenom` for print-plot scale.
   */
  it("free-plan mesh step follows the fitted scaleM, not the hardcoded 1:100", () => {
    const { boardWidthM } = fitParcel();
    // TactileGround resolvedScaleM = scaleM ?? boardScaleM(sheetScaleDenom).
    const freePlanScaleM = boardWidthM;
    const freePlanStep = pickMetricStepM(
      visibleMetresFromScale(freePlanScaleM, 1),
    );
    const fitSheetStep = pickMetricStepM(visibleMetres(100, 1));
    // Rural board ~1900 m -> 100 m mesh cells. Hardcoded 110 m board -> 10 m.
    expect(freePlanStep).toBeGreaterThanOrEqual(50);
    expect(fitSheetStep).toBe(10);
    // The two scales must disagree on a rural parcel — this is the bug class.
    expect(freePlanScaleM).not.toBe(boardScaleM(100));
  });

  it("chip copy drops the print denominator when scaleM is fitted (free plan)", () => {
    const { boardWidthM } = fitParcel();
    const freePlanStep = pickMetricStepM(
      visibleMetresFromScale(boardWidthM, 1),
    );
    // TactileGround chip: scaleM ? `${stepM} m` : `${stepM} m · 1:${sheetScaleDenom}`.
    const freePlanChip = `${freePlanStep} m`;
    const fitSheetChip = `${pickMetricStepM(visibleMetres(100, 1))} m · 1:100`;
    expect(freePlanChip).not.toContain("1:");
    expect(fitSheetChip).toContain("1:100");
  });

  it("default scaleM (no fit) agrees with the 1:100 fallback so urban plans don't regress", () => {
    // When boardWidthM is unset, TactileGround falls back to boardScaleM(100)=110.
    // The mesh + chip must match the legacy behavior on a small urban lot.
    const fallbackScaleM = boardScaleM(100);
    const fallbackStep = pickMetricStepM(
      visibleMetresFromScale(fallbackScaleM, 1),
    );
    const legacyStep = pickMetricStepM(visibleMetres(100, 1));
    expect(fallbackScaleM).toBe(110);
    expect(fallbackStep).toBe(legacyStep);
  });
});

describe("measurement integrity: displayed lot area == drawn shoelace", () => {
  it("round-trips the fitted ring through percent-space at the fitted scale", () => {
    const { boardWidthM, drawnAreaM2, perimeterM } = fitParcel();
    // The fit is isotropic, so the drawn shoelace must recover the true area.
    expect(drawnAreaM2).toBeCloseTo(1_088_000, -3);
    // Isoperimetric sanity: no polygon's area can exceed P^2/(4 pi).
    const maxArea = perimeterM ** 2 / (4 * Math.PI);
    expect(drawnAreaM2).toBeLessThanOrEqual(maxArea * 1.01);
    expect(boardWidthM).toBeGreaterThan(1000);
  });

  it("agrees with the cadastral area when both describe the same polygon", () => {
    const { drawnAreaM2 } = fitParcel();
    const cadastral = Math.round(polygonArea(RURAL_LNGLAT_RING));
    const display = resolveSiteAreaDisplay({
      schedule: buildSiteSchedule(
        fitParcel().points,
        [],
        fitParcel().boardWidthM,
        1,
      ),
      cadastralLotM2: cadastral,
      cadastralHouseM2: null,
    });
    const rel = Math.abs(display.lotAreaM2 - drawnAreaM2) / drawnAreaM2;
    expect(rel).toBeLessThanOrEqual(TOL_AREA_FRAC);
  });

  it("rejects a 10x cadastral figure when the drawn ring is a subset (rural)", () => {
    // Observed on a rural parcel: edges 1617/893/768/762/724/635 m bound ~1.1M
    // m^2, but the Vicmap lot-area label read 10,340,197 m^2. A 5399 m perimeter
    // cannot bound 10.3M m^2 (isoperimetric max ~2.32M), so the label describes
    // a different polygon than the drawing. The display must follow the drawn
    // ring, not the stale whole-parcel figure.
    const fit = fitParcel();
    const subsetDisplay = resolveSiteAreaDisplay({
      schedule: buildSiteSchedule(fit.points, [], fit.boardWidthM, 1),
      cadastralLotM2: 10_340_197,
      cadastralHouseM2: null,
    });
    const rel = Math.abs(subsetDisplay.lotAreaM2 - fit.drawnAreaM2) / fit.drawnAreaM2;
    expect(rel).toBeLessThanOrEqual(TOL_AREA_FRAC);
    expect(subsetDisplay.lotSource).toBe("drawing");
  });

  it("surfaces lot disagreement provenance — does not silently prefer drawing", () => {
    // The display follows the drawn ring, but the architect must SEE that the
    // title disagreed: both numbers, and a mismatch flag. Same provenance
    // discipline as "Vicmap footprint" vs "operator-traced envelope".
    const fit = fitParcel();
    const display = resolveSiteAreaDisplay({
      schedule: buildSiteSchedule(fit.points, [], fit.boardWidthM, 1),
      cadastralLotM2: 10_340_197,
      cadastralHouseM2: null,
    });
    expect(display.lotDisagreement).not.toBeNull();
    expect(display.lotDisagreement!.mismatch).toBe(true);
    expect(display.lotDisagreement!.cadastralLotM2).toBe(10_340_197);
    expect(display.lotDisagreement!.drawnLotM2).toBeCloseTo(
      fit.drawnAreaM2,
      -3,
    );
  });

  it("does not flag disagreement when title and drawn match", () => {
    const fit = fitParcel();
    const cadastral = Math.round(fit.drawnAreaM2);
    const display = resolveSiteAreaDisplay({
      schedule: buildSiteSchedule(fit.points, [], fit.boardWidthM, 1),
      cadastralLotM2: cadastral,
      cadastralHouseM2: null,
    });
    expect(display.lotDisagreement).not.toBeNull();
    expect(display.lotDisagreement!.mismatch).toBe(false);
  });

  it("reports null disagreement when no cadastral figure is supplied", () => {
    const fit = fitParcel();
    const display = resolveSiteAreaDisplay({
      schedule: buildSiteSchedule(fit.points, [], fit.boardWidthM, 1),
      cadastralLotM2: null,
      cadastralHouseM2: null,
    });
    expect(display.lotDisagreement).toBeNull();
  });

  it("keeps cadastral when the drawn ring matches it (no regression)", () => {
    const fit = fitParcel();
    const cadastral = Math.round(fit.drawnAreaM2);
    const display: FitSheetAreaDisplay = resolveSiteAreaDisplay({
      schedule: buildSiteSchedule(fit.points, [], fit.boardWidthM, 1),
      cadastralLotM2: cadastral,
      cadastralHouseM2: null,
    });
    expect(display.lotSource).toBe("cadastral");
  });
});
