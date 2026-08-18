import { describe, expect, it } from "vitest";
import {
  LAYER_IDS,
  LAYER_REGISTRY,
  getLayerDefinition,
  getLayerStyle,
  isBoundaryConstraintLayer,
  isRegisteredLayerId,
  layerTriggersDigSafety,
  layerYOffset,
} from "./layerRegistry";

describe("layerRegistry", () => {
  it("defines every canonical layer id", () => {
    for (const id of LAYER_IDS) {
      expect(LAYER_REGISTRY[id]).toBeDefined();
      expect(LAYER_REGISTRY[id].id).toBe(id);
      expect(LAYER_REGISTRY[id].displayName.length).toBeGreaterThan(0);
    }
    expect(LAYER_IDS.length).toBeGreaterThanOrEqual(6);
  });

  it("uses a DETERMINISTIC y-bias ladder with no shared offsets", () => {
    const offsets = LAYER_IDS.map((id) => layerYOffset(id));
    expect(new Set(offsets).size).toBe(offsets.length);
    // The documented z-fight pair (trench ∩ easements at y=0.05) is
    // separated deterministically, and the survey truth line rides highest.
    expect(layerYOffset("civil.trench")).toBeLessThan(
      layerYOffset("vicmap.easement"),
    );
    expect(layerYOffset("vicmap.easement")).toBeLessThan(
      layerYOffset("cadastre.title_boundary"),
    );
  });

  it("styles carry token-allowlisted colors and valid render values", () => {
    for (const id of LAYER_IDS) {
      expect(getLayerStyle(id).color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(getLayerStyle(id).lineWidthPx).toBeGreaterThan(0);
      expect(getLayerStyle(id).opacity).toBeGreaterThan(0);
      expect(getLayerStyle(id).opacity).toBeLessThanOrEqual(1);
    }
  });

  it("encodes the spatial policies", () => {
    expect(isBoundaryConstraintLayer("cadastre.title_boundary")).toBe(true);
    expect(isBoundaryConstraintLayer("cadastre.building_footprint")).toBe(true);
    expect(isBoundaryConstraintLayer("vicmap.easement")).toBe(false);
    expect(layerTriggersDigSafety("vicmap.easement")).toBe(true);
    expect(layerTriggersDigSafety("services.gas")).toBe(true);
    expect(layerTriggersDigSafety("civil.trench")).toBe(false);
  });

  it("isRegisteredLayerId rejects unknown ids", () => {
    expect(isRegisteredLayerId("cadastre.title_boundary")).toBe(true);
    expect(isRegisteredLayerId("not.a.layer")).toBe(false);
  });

  it("getLayerDefinition returns the immutable definition", () => {
    const def = getLayerDefinition("vicmap.easement");
    expect(def.group).toBe("survey");
    expect(def.provenanceSource).toBe("council_gis");
    expect(def.style.dashArray).toEqual([0.4, 0.3]);
    expect(def.policies.triggersDigSafetyAlert).toBe(true);
  });
});
