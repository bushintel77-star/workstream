import { describe, expect, it } from "vitest";
import { DEFAULT_NIB } from "./nibs";
import { NIBS } from "./nibs";
import { useStudioStore } from "./studioStore";

/**
 * Tier-1 widget standard — the palette/brush store behaviours behind
 * Widget A + Widget B: material recents, previous-swap, per-nib smoothing
 * defaults (which stop the moment the operator owns the dial), and the
 * brush opacity clamp.
 */
describe("studioStore Tier-1 palette + brush state", () => {
  it("arms a first material without inventing a previous or recents", () => {
    const store = useStudioStore.getState();
    store.setActiveMaterialId("moss");
    const s = useStudioStore.getState();
    expect(s.activeMaterialId).toBe("moss");
    expect(s.previousMaterialId).toBeNull();
    expect(s.recentMaterialIds).toEqual([]);
  });

  it("remembers the outgoing material as previous and stacks recents", () => {
    const store = useStudioStore.getState();
    store.setActiveMaterialId("corten"); // previous: moss
    store.setActiveMaterialId("water"); // previous: corten
    const s = useStudioStore.getState();
    expect(s.previousMaterialId).toBe("corten");
    expect(s.recentMaterialIds).toEqual(["corten", "moss"]);
  });

  it("caps the recent row at 6, never duplicating", () => {
    const store = useStudioStore.getState();
    for (const id of [
      "moss", "sage", "olive", "chartreuse", "fern",
      "silver-foliage", "corten", "bluestone",
    ]) {
      store.setActiveMaterialId(id);
    }
    const recents = useStudioStore.getState().recentMaterialIds;
    expect(recents).toHaveLength(6);
    expect(new Set(recents).size).toBe(6);
    // Recents hold the OUTGOING materials — the current pick lives in the
    // well — so the newest row entry is the one bluestone displaced.
    expect(recents[0]).toBe("corten");
    expect(useStudioStore.getState().activeMaterialId).toBe("bluestone");
  });

  it("swap exchanges current and previous (X key / well click)", () => {
    const store = useStudioStore.getState();
    store.setActiveMaterialId("sage");
    store.setActiveMaterialId("olive");
    store.swapActiveMaterial();
    const s = useStudioStore.getState();
    expect(s.activeMaterialId).toBe("sage");
    expect(s.previousMaterialId).toBe("olive");
  });

  it("per-nib smoothing defaults apply until the operator touches the dial", () => {
    const store = useStudioStore.getState();
    // Fresh arm of the technical pen takes its 5% default.
    store.setActiveNib("ink-03");
    expect(useStudioStore.getState().strokeSmoothing).toBe(
      NIBS["ink-03"].defaultSmoothing,
    );
    // The operator's choice sticks across nib switches.
    store.setStrokeSmoothing(0.5);
    store.setActiveNib("chisel-marker");
    expect(useStudioStore.getState().strokeSmoothing).toBe(0.5);
    expect(useStudioStore.getState().smoothingTouched).toBe(true);
  });

  it("the initial dial value is the default nib's smoothing (no drift)", () => {
    expect(NIBS[DEFAULT_NIB].defaultSmoothing).toBe(0.2);
    const initial = useStudioStore.getInitialState();
    expect(initial.smoothingTouched).toBe(false);
    expect(initial.strokeSmoothing).toBe(0.2);
  });

  it("clamps the brush opacity override to 5–100%", () => {
    const store = useStudioStore.getState();
    store.setBrushOpacity(2);
    expect(useStudioStore.getState().brushOpacity).toBe(1);
    store.setBrushOpacity(0.01);
    expect(useStudioStore.getState().brushOpacity).toBe(0.05);
    store.setBrushOpacity(null);
    expect(useStudioStore.getState().brushOpacity).toBeNull();
  });

  it("bulk plane assignment moves N features in ONE history commit", () => {
    const store = useStudioStore.getState();
    store.setFeatures([]);
    useStudioStore.setState({ historyPast: [] });
    store.addFeatures([
      { id: "f1", type: "LandscapeFeature", metadata: { layer: "hardscape", timestamp_created: new Date().toISOString(), source_attribution: "human_drawn", user_modification_state: "draft" }, geometry: { type: "LineString", spatial_reference: "EPSG:3857", canvas_origin_pct: { x_pct: 0, y_pct: 0 }, points: [] } },
      { id: "f2", type: "LandscapeFeature", metadata: { layer: "hardscape", timestamp_created: new Date().toISOString(), source_attribution: "human_drawn", user_modification_state: "draft" }, geometry: { type: "LineString", spatial_reference: "EPSG:3857", canvas_origin_pct: { x_pct: 0, y_pct: 0 }, points: [] } },
    ] as never);
    const historyBefore = useStudioStore.getState().historyPast.length;
    const moved = store.assignFeaturesToPlane(["f1", "f2"], "planting");
    const s = useStudioStore.getState();
    expect(moved).toBe(2);
    // One decision = one undo step, whatever the count.
    expect(s.historyPast.length).toBe(historyBefore + 1);
    expect(s.features.every((f) => f.plane_z_m === 1.5)).toBe(true);
    // Untouched ids are untouched.
    expect(store.assignFeaturesToPlane(["fX"], "ground")).toBe(0);
  });
});
