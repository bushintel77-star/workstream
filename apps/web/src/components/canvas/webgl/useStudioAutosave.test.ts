import { describe, expect, it } from "vitest";
import { buildPersistKey, type StudioAutosaveDoc } from "./useStudioAutosave";

/**
 * Tests for the autosave content fingerprint. The fingerprint is the dirty-
 * tracking key — if it doesn't change when a meaningful field changes, the
 * save won't fire and operator work is lost.
 */
describe("buildPersistKey", () => {
  const baseStroke = {
    id: "stroke-1",
    points: [{ x_pct: 10, y_pct: 20 }, { x_pct: 30, y_pct: 40 }],
    color: "#ff2ef6",
    width_px: 2.5,
  };

  it("is stable when nothing changes", () => {
    const doc: StudioAutosaveDoc = { placements: [], strokes: [baseStroke] };
    expect(buildPersistKey(doc)).toBe(buildPersistKey(doc));
  });

  it("changes when a stroke's extrude_height_m changes", () => {
    const without: StudioAutosaveDoc = {
      placements: [],
      strokes: [baseStroke],
    };
    const withExtrude: StudioAutosaveDoc = {
      placements: [],
      strokes: [{ ...baseStroke, extrude_height_m: 1.5 }],
    };
    const tallerExtrude: StudioAutosaveDoc = {
      placements: [],
      strokes: [{ ...baseStroke, extrude_height_m: 2.5 }],
    };
    // All three must be distinct — otherwise extrude commits won't persist.
    const a = buildPersistKey(without);
    const b = buildPersistKey(withExtrude);
    const c = buildPersistKey(tallerExtrude);
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });

  it("changes when a stroke's point array changes", () => {
    const original: StudioAutosaveDoc = {
      placements: [],
      strokes: [baseStroke],
    };
    const moved: StudioAutosaveDoc = {
      placements: [],
      strokes: [
        { ...baseStroke, points: [{ x_pct: 11, y_pct: 20 }, { x_pct: 30, y_pct: 40 }] },
      ],
    };
    expect(buildPersistKey(original)).not.toBe(buildPersistKey(moved));
  });

  it("ignores sub-decimal point jitter (rounds to 1 decimal)", () => {
    // 10.01 and 10.04 both round to 10.0 → no spurious save.
    const a: StudioAutosaveDoc = {
      placements: [],
      strokes: [{ ...baseStroke, points: [{ x_pct: 10.01, y_pct: 20 }, { x_pct: 30, y_pct: 40 }] }],
    };
    const b: StudioAutosaveDoc = {
      placements: [],
      strokes: [{ ...baseStroke, points: [{ x_pct: 10.04, y_pct: 20 }, { x_pct: 30, y_pct: 40 }] }],
    };
    expect(buildPersistKey(a)).toBe(buildPersistKey(b));
  });

  it("changes when stroke count changes", () => {
    const one: StudioAutosaveDoc = { placements: [], strokes: [baseStroke] };
    const two: StudioAutosaveDoc = {
      placements: [],
      strokes: [baseStroke, { ...baseStroke, id: "stroke-2" }],
    };
    expect(buildPersistKey(one)).not.toBe(buildPersistKey(two));
  });

  it("changes when a photo elevation is calibrated or gains a trace stroke", () => {
    const base = {
      id: "elev-1",
      photo_id: "photo-1",
      name: "Rear fence",
      uri: "https://example.com/photos/rear.png",
      natural_aspect: 1.5,
      azimuth_deg: 180,
      calibration: null,
      centre_x_m: 0,
      centre_z_m: 0,
      ground_offset_m: 0,
      boundary_snap: null,
      strokes: [],
      created_at: "2026-08-18T00:00:00.000Z",
      updated_at: "2026-08-18T00:00:00.000Z",
    };
    const uncalibrated: StudioAutosaveDoc = {
      placements: [],
      strokes: [],
      photoElevations: [base],
    };
    const calibrated: StudioAutosaveDoc = {
      placements: [],
      strokes: [],
      photoElevations: [
        {
          ...base,
          calibration: {
            plane_width_m: 6,
            reference_m: 1.8,
            label: "1.8 m fence line",
          },
        },
      ],
    };
    const traced: StudioAutosaveDoc = {
      placements: [],
      strokes: [],
      photoElevations: [
        {
          ...base,
          strokes: [
            {
              id: "pstroke-1",
              points: [{ x_m: 0, y_m: 1.8 }],
              width_px: 2,
              color: "#0030CF",
            },
          ],
        },
      ],
    };
    const a = buildPersistKey(uncalibrated);
    expect(a).not.toBe(buildPersistKey(calibrated));
    expect(a).not.toBe(buildPersistKey(traced));
  });

  it("changes when a converted LandscapeFeature changes", () => {
    const feature = {
      id: "feat-1",
      type: "LandscapeFeature" as const,
      metadata: {
        layer: "hardscape" as const,
        friendly_name: "Path (1.2 m × 0.075 m)",
        timestamp_created: "2026-08-18T00:00:00.000Z",
        source_attribution: "human_drawn" as const,
        user_modification_state: "draft" as const,
      },
      geometry: {
        type: "LineString" as const,
        spatial_reference: "EPSG:3857",
        canvas_origin_pct: { x_pct: 0, y_pct: 0 },
        points: [
          { id: "feat-1-v0", pct: { x_pct: 10, y_pct: 20 } },
          { id: "feat-1-v1", pct: { x_pct: 30, y_pct: 40 } },
        ],
      },
      material_fill: {
        type: "surface" as const,
        sku: "PAVE-BLUESTONE",
        depth_m: 0.075,
        waste_allocation_pct: 10,
      },
      labor_profile: {
        base_difficulty_tier: "standard_soil" as const,
        estimated_install_hours: 0.7,
        calculated_labor_cost_aud: 0,
      },
    };
    const without: StudioAutosaveDoc = { placements: [], strokes: [], features: [] };
    const withFeature: StudioAutosaveDoc = {
      placements: [],
      strokes: [],
      features: [feature],
    };
    const moved: StudioAutosaveDoc = {
      placements: [],
      strokes: [],
      features: [
        {
          ...feature,
          geometry: {
            ...feature.geometry,
            points: [
              { id: "feat-1-v0", pct: { x_pct: 11, y_pct: 20 } },
              { id: "feat-1-v1", pct: { x_pct: 30, y_pct: 40 } },
            ],
          },
        },
      ],
    };
    const a = buildPersistKey(without);
    const b = buildPersistKey(withFeature);
    const c = buildPersistKey(moved);
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
  });

  /* ---------------------------------------------------------------------- */
  /* Step 0 — inspector-editable field coverage                             */
  /* ---------------------------------------------------------------------- */
  /* The inspector edits these fields; if any of them fails to change the   */
  /* persist key, the edit never autosaves and is lost on reload.           */

  const basePlacement = {
    id: "c39b0a2c-1111-4222-8333-000000000001",
    symbol_id: "OLIVE-STD",
    x_pct: 42,
    y_pct: 36,
    rotation_deg: 0,
    scale: 1,
  };

  it("changes when a placement's label, height, canopy radius, or source changes", () => {
    const base: StudioAutosaveDoc = {
      placements: [basePlacement],
      strokes: [],
    };
    const withLabel: StudioAutosaveDoc = {
      placements: [{ ...basePlacement, label: "Feature olive" }],
      strokes: [],
    };
    const withHeight: StudioAutosaveDoc = {
      placements: [{ ...basePlacement, height_m: 2.4 }],
      strokes: [],
    };
    const withCanopy: StudioAutosaveDoc = {
      placements: [{ ...basePlacement, canopy_radius_m: 3.2 }],
      strokes: [],
    };
    const withSource: StudioAutosaveDoc = {
      placements: [{ ...basePlacement, source: "vicmap_tree" as const }],
      strokes: [],
    };
    const a = buildPersistKey(base);
    expect(a).not.toBe(buildPersistKey(withLabel));
    expect(a).not.toBe(buildPersistKey(withHeight));
    expect(a).not.toBe(buildPersistKey(withCanopy));
    expect(a).not.toBe(buildPersistKey(withSource));
  });

  const baseFeature = {
    id: "feat-2",
    type: "LandscapeFeature" as const,
    metadata: {
      layer: "softscape_beds" as const,
      friendly_name: "Lomandra bed",
      timestamp_created: "2026-08-18T00:00:00.000Z",
      source_attribution: "human_drawn" as const,
      user_modification_state: "draft" as const,
    },
    geometry: {
      type: "Polygon" as const,
      spatial_reference: "EPSG:3857",
      canvas_origin_pct: { x_pct: 0, y_pct: 0 },
      points: [
        { id: "feat-2-v0", pct: { x_pct: 10, y_pct: 10 } },
        { id: "feat-2-v1", pct: { x_pct: 20, y_pct: 10 } },
        { id: "feat-2-v2", pct: { x_pct: 20, y_pct: 20 } },
      ],
    },
    material_fill: {
      type: "surface" as const,
      sku: "LOMANDRA-MASS",
      depth_m: 0.075,
      waste_allocation_pct: 10,
    },
    labor_profile: {
      base_difficulty_tier: "standard_soil" as const,
      estimated_install_hours: 1.2,
      calculated_labor_cost_aud: 0,
    },
  };

  it("changes when a feature's material fill changes", () => {
    const base: StudioAutosaveDoc = {
      placements: [],
      strokes: [],
      features: [baseFeature],
    };
    const skuChange: StudioAutosaveDoc = {
      placements: [],
      strokes: [],
      features: [
        {
          ...baseFeature,
          material_fill: { ...baseFeature.material_fill, sku: "BLUESTONE-PAVE" },
        },
      ],
    };
    const depthChange: StudioAutosaveDoc = {
      placements: [],
      strokes: [],
      features: [
        {
          ...baseFeature,
          material_fill: { ...baseFeature.material_fill, depth_m: 0.12 },
        },
      ],
    };
    const wasteChange: StudioAutosaveDoc = {
      placements: [],
      strokes: [],
      features: [
        {
          ...baseFeature,
          material_fill: { ...baseFeature.material_fill, waste_allocation_pct: 15 },
        },
      ],
    };
    const a = buildPersistKey(base);
    expect(a).not.toBe(buildPersistKey(skuChange));
    expect(a).not.toBe(buildPersistKey(depthChange));
    expect(a).not.toBe(buildPersistKey(wasteChange));
  });

  it("changes when a feature's friendly name or modification state changes", () => {
    const base: StudioAutosaveDoc = {
      placements: [],
      strokes: [],
      features: [baseFeature],
    };
    const nameChange: StudioAutosaveDoc = {
      placements: [],
      strokes: [],
      features: [
        {
          ...baseFeature,
          metadata: { ...baseFeature.metadata, friendly_name: "Front bed" },
        },
      ],
    };
    const stateChange: StudioAutosaveDoc = {
      placements: [],
      strokes: [],
      features: [
        {
          ...baseFeature,
          metadata: {
            ...baseFeature.metadata,
            user_modification_state: "human_locked" as const,
          },
        },
      ],
    };
    const a = buildPersistKey(base);
    expect(a).not.toBe(buildPersistKey(nameChange));
    expect(a).not.toBe(buildPersistKey(stateChange));
  });

  it("changes when a feature's scatter recipe or labor tier changes", () => {
    const withScatter = {
      ...baseFeature,
      procedural_scatter_contents: {
        brush_recipe_id: "LOMANDRA-30CM",
        seed_value: 7,
        instances: [],
      },
    };
    const base: StudioAutosaveDoc = {
      placements: [],
      strokes: [],
      features: [withScatter],
    };
    const recipeChange: StudioAutosaveDoc = {
      placements: [],
      strokes: [],
      features: [
        {
          ...withScatter,
          procedural_scatter_contents: {
            ...withScatter.procedural_scatter_contents,
            brush_recipe_id: "LOMANDRA-45CM",
          },
        },
      ],
    };
    const laborChange: StudioAutosaveDoc = {
      placements: [],
      strokes: [],
      features: [
        {
          ...withScatter,
          labor_profile: {
            ...baseFeature.labor_profile,
            base_difficulty_tier: "constrained" as const,
          },
        },
      ],
    };
    const a = buildPersistKey(base);
    expect(a).not.toBe(buildPersistKey(recipeChange));
    expect(a).not.toBe(buildPersistKey(laborChange));
  });
});
