import { describe, expect, it } from "vitest";
import {
  classifyAs4970Encroachment,
  combinedDbhM,
  computeAs4970ProtectionZones,
  nrzRadiusFromDbhCm,
  nrzRadiusFromDbhM,
  srzRadiusFromTrunkM,
} from "./as4970-protection-zones";

describe("as4970-protection-zones", () => {
  it("clamps NRZ to 2–15 m", () => {
    expect(nrzRadiusFromDbhM(0.1)).toBe(2); // 1.2 → 2
    expect(nrzRadiusFromDbhM(0.5)).toBe(6);
    expect(nrzRadiusFromDbhM(2)).toBe(15); // 24 → 15
    expect(nrzRadiusFromDbhCm(50)).toBe(6);
  });

  it("combines multi-stem DBH as sqrt(sum squares)", () => {
    expect(combinedDbhM([0.3, 0.4])).toBeCloseTo(0.5, 5);
    expect(combinedDbhM([0.4])).toBe(0.4);
    expect(combinedDbhM([])).toBe(0);
  });

  it("computes SRZ with 1.5 m floor", () => {
    const small = srzRadiusFromTrunkM(0.05);
    expect(small).toBeGreaterThanOrEqual(1.5);
    const mid = srzRadiusFromTrunkM(0.4);
    expect(mid).toBeGreaterThan(1.5);
    expect(mid).toBeLessThan(nrzRadiusFromDbhM(0.4));
  });

  it("returns paired NRZ/SRZ from compute helper", () => {
    const z = computeAs4970ProtectionZones([0.3, 0.4]);
    expect(z.dbh_m).toBeCloseTo(0.5, 5);
    expect(z.nrz_radius_m).toBe(6);
    expect(z.srz_radius_m).toBeGreaterThanOrEqual(1.5);
  });

  it("classifies encroachment tiers including SRZ major", () => {
    expect(
      classifyAs4970Encroachment({ nrzAreaEncroachPct: 0.01, intrudesSrz: false }),
    ).toBe("none");
    expect(
      classifyAs4970Encroachment({ nrzAreaEncroachPct: 8, intrudesSrz: false }),
    ).toBe("minor");
    expect(
      classifyAs4970Encroachment({ nrzAreaEncroachPct: 15, intrudesSrz: false }),
    ).toBe("moderate");
    expect(
      classifyAs4970Encroachment({ nrzAreaEncroachPct: 25, intrudesSrz: false }),
    ).toBe("major");
    expect(
      classifyAs4970Encroachment({ nrzAreaEncroachPct: 1, intrudesSrz: true }),
    ).toBe("major");
  });
});
