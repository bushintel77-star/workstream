import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { DEFAULT_NIB } from "./nibs";
import { NIBS } from "./nibs";
import { useStudioStore } from "./studioStore";
import { readBrushPrefs, writeBrushPrefs } from "./brushPrefs";

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

describe("studioStore Tier-1 brush-state persistence (handover §4.5)", () => {
  let backing: Map<string, string>;

  beforeEach(() => {
    backing = new Map();
    (globalThis as Record<string, unknown>).sessionStorage = {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, value),
    };
    useStudioStore.setState({
      projectId: "",
      activeNib: DEFAULT_NIB,
      activeMaterialId: null,
      brushWidthOverride: null,
      brushOpacity: null,
      smoothingTouched: false,
      strokeSmoothing: NIBS[DEFAULT_NIB].defaultSmoothing,
      recentMaterialIds: [],
      previousMaterialId: null,
    });
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).sessionStorage;
  });

  it("hydrateBrushPrefs restores the project's armed nib, material, width, opacity", () => {
    writeBrushPrefs("p1", {
      nib: "ink-03",
      materialId: "corten",
      widthPx: 9,
      opacity: 0.55,
    });
    useStudioStore.getState().setProjectContext("p1", null, "");
    useStudioStore.getState().hydrateBrushPrefs("p1");
    const s = useStudioStore.getState();
    expect(s.activeNib).toBe("ink-03");
    // The restored nib brings its smoothing default (the operator hasn't
    // touched the dial in this fresh session).
    expect(s.strokeSmoothing).toBe(NIBS["ink-03"].defaultSmoothing);
    expect(s.activeMaterialId).toBe("corten");
    expect(s.brushWidthOverride).toBe(9);
    expect(s.brushOpacity).toBe(0.55);
  });

  it("restoring does not rewrite the palette's recent/previous memory", () => {
    writeBrushPrefs("p1", { materialId: "olive" });
    useStudioStore.getState().setProjectContext("p1", null, "");
    useStudioStore.getState().hydrateBrushPrefs("p1");
    const s = useStudioStore.getState();
    expect(s.activeMaterialId).toBe("olive");
    // Recents/previous record what the operator picked THIS session; a
    // restored arm is a restore, not a pick.
    expect(s.recentMaterialIds).toEqual([]);
    expect(s.previousMaterialId).toBeNull();
  });

  it("operator dial changes persist under the current project's key", () => {
    useStudioStore.getState().setProjectContext("p1", null, "");
    useStudioStore.getState().setActiveNib("stipple");
    const saved = readBrushPrefs("p1");
    expect(saved?.nib).toBe("stipple");
    // The write stamps the whole armed set, not just the changed field.
    expect(saved).toEqual({
      nib: "stipple",
      materialId: useStudioStore.getState().activeMaterialId,
      widthPx: useStudioStore.getState().brushWidthOverride,
      opacity: useStudioStore.getState().brushOpacity,
    });
  });

  it("a project switch never stamps the outgoing pen onto the incoming key", () => {
    const store = useStudioStore.getState();
    store.setProjectContext("p1", null, "");
    store.setActiveNib("ink-03");
    expect(readBrushPrefs("p1")?.nib).toBe("ink-03");
    // Navigation: projectId flips while the brush fields still hold p1's
    // state (hydrateBrushPrefs for p2 has not run yet). That mid-swap state
    // must not be written anywhere.
    useStudioStore.setState({ projectId: "p2" });
    expect(backing.has("ws-brush-prefs:p2")).toBe(false);
    // p2 has nothing saved → hydrate is a no-op → the operator keeps drawing
    // with p1's pen until they choose (defaults apply on a fresh reload).
    useStudioStore.getState().hydrateBrushPrefs("p2");
    expect(useStudioStore.getState().activeNib).toBe("ink-03");
    // And the first choice on p2 lands under p2, leaving p1's record alone.
    useStudioStore.getState().setBrushWidthOverride(14);
    expect(readBrushPrefs("p2")?.widthPx).toBe(14);
    expect(readBrushPrefs("p1")?.nib).toBe("ink-03");
    expect(backing.get("ws-brush-prefs:p1")).not.toContain("14");
  });
});
