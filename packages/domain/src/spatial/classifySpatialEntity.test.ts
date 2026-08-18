import { describe, expect, it } from "vitest";
import {
  classifySpatialEntity,
  classifyVicmapFeature,
  matchVicmapToLayerId,
  provenanceOf,
} from "./classifySpatialEntity";

describe("classifyVicmapFeature", () => {
  it("maps cadastre boundaries to the title layer and preserves raw attributes", () => {
    const f = classifyVicmapFeature({
      id: "vic-1",
      geometry: { type: "Polygon" },
      attributes: { kind: "BOUNDARY", source_ref: "VICMAP" },
    });
    expect(f.layerId).toBe("cadastre.title_boundary");
    expect(f.meta.source).toBe("vicmap");
    expect(f.meta.rawAttributes).toEqual({
      kind: "BOUNDARY",
      source_ref: "VICMAP",
    });
    expect(f.meta.classification.confidence).toBe("high");
    expect(f.userModificationState).toBe("system_imported");
  });

  it("classifies easements by kind or easement_type", () => {
    expect(matchVicmapToLayerId({ kind: "EASEMENT" })).toBe("vicmap.easement");
    expect(matchVicmapToLayerId({ easement_type: "drainage" })).toBe(
      "vicmap.easement",
    );
  });

  it("classifies gas services by service_class", () => {
    expect(matchVicmapToLayerId({ service_class: "GAS" })).toBe("services.gas");
    expect(matchVicmapToLayerId({ service_class: "WATER" })).toBe(
      "vicmap.gov_overlay",
    );
  });

  it("falls back to the overlay layer for unclassified state GIS", () => {
    expect(matchVicmapToLayerId({ kind: "something_else" })).toBe(
      "vicmap.gov_overlay",
    );
  });
});

describe("classifySpatialEntity", () => {
  it("maps DXF layer names to canonical layers", () => {
    expect(
      classifySpatialEntity({
        id: "d1",
        source: "dxf",
        attributes: { layer: "EASEMENT" },
      }).layerId,
    ).toBe("vicmap.easement");
    expect(
      classifySpatialEntity({
        id: "d2",
        source: "dxf",
        attributes: { layer: "TRENCH" },
      }).layerId,
    ).toBe("civil.trench");
  });

  it("routes user strokes to the draft layer", () => {
    const s = classifySpatialEntity({ id: "s1", source: "user_stroke" });
    expect(s.layerId).toBe("draft.user_draft");
    expect(s.userModificationState).toBe("user_drawn");
  });

  it("honours a registered layerId hint but never trusts unknown ones", () => {
    expect(
      classifySpatialEntity({
        id: "c1",
        source: "cad",
        attributes: { layerId: "civil.irrigation_main" },
      }).layerId,
    ).toBe("civil.irrigation_main");
    const bad = classifySpatialEntity({
      id: "c2",
      source: "cad",
      attributes: { layerId: "hacker.layer" },
    });
    expect(bad.layerId).toBe("draft.user_draft");
    expect(bad.meta.classification.confidence).toBe("low");
  });

  it("derives provenance from the source", () => {
    expect(
      provenanceOf(classifyVicmapFeature({ id: "v", attributes: {} })),
    ).toBe("state_cadastre");
    expect(
      provenanceOf(classifySpatialEntity({ id: "s", source: "user_stroke" })),
    ).toBe("user_drawn");
  });
});
