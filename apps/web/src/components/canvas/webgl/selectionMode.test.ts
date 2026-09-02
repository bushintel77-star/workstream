import { describe, it, expect, beforeEach } from "vitest";
import { useStudioStore } from "./studioStore";
import type { SelectionRef } from "./selectionPick";
import type { CatalogPlacement, LandscapeFeature, PhotoElevation } from "@workstream/contracts";

function reset() {
  useStudioStore.setState({
    placements: [],
    features: [],
    photoElevations: [],
    selection: [],
    selectionModeActive: false,
  });
}

function makePlacement(id: string): CatalogPlacement {
  return {
    id,
    symbol_id: "tree",
    x_pct: 50,
    y_pct: 50,
    scale: 1,
    rotation_deg: 0,
    label: id,
  } as CatalogPlacement;
}

function makeFeature(id: string): LandscapeFeature {
  return {
    id,
    kind: "Polygon",
    geometry: { type: "Polygon", points: [{ pct: { x_pct: 50, y_pct: 50 } }] },
    friendly_name: id,
  } as unknown as LandscapeFeature;
}

function makePhotoElevation(id: string, strokeIds: string[]): PhotoElevation {
  return {
    id,
    label: id,
    strokes: strokeIds.map((sid) => ({
      id: sid,
      points: [{ x_m: 0, y_m: 0 }],
    })),
  } as unknown as PhotoElevation;
}

describe("Phase H — selection mode + boolean ops", () => {
  beforeEach(reset);

  it("toggleSelectionMode flips the flag", () => {
    expect(useStudioStore.getState().selectionModeActive).toBe(false);
    useStudioStore.getState().toggleSelectionMode();
    expect(useStudioStore.getState().selectionModeActive).toBe(true);
    useStudioStore.getState().toggleSelectionMode();
    expect(useStudioStore.getState().selectionModeActive).toBe(false);
  });

  it("setSelectionMode sets explicitly", () => {
    useStudioStore.getState().setSelectionMode(true);
    expect(useStudioStore.getState().selectionModeActive).toBe(true);
    useStudioStore.getState().setSelectionMode(false);
    expect(useStudioStore.getState().selectionModeActive).toBe(false);
  });

  it("subtractFromSelection removes matching refs", () => {
    const refs: SelectionRef[] = [
      { kind: "placement", id: "p1" },
      { kind: "placement", id: "p2" },
      { kind: "feature", id: "f1" },
    ];
    useStudioStore.getState().setSelection(refs);
    useStudioStore.getState().subtractFromSelection([
      { kind: "placement", id: "p1" },
    ]);
    const sel = useStudioStore.getState().selection;
    expect(sel).toHaveLength(2);
    expect(sel.find((r) => r.id === "p1")).toBeUndefined();
    expect(sel.find((r) => r.id === "p2")).toBeDefined();
    expect(sel.find((r) => r.id === "f1")).toBeDefined();
  });

  it("subtractFromSelection with elevationId matches correctly", () => {
    const refs: SelectionRef[] = [
      { kind: "photoStroke", id: "s1", elevationId: "e1" },
      { kind: "photoStroke", id: "s2", elevationId: "e1" },
    ];
    useStudioStore.getState().setSelection(refs);
    useStudioStore.getState().subtractFromSelection([
      { kind: "photoStroke", id: "s1", elevationId: "e1" },
    ]);
    const sel = useStudioStore.getState().selection;
    expect(sel).toHaveLength(1);
    expect(sel[0]!.id).toBe("s2");
  });

  it("invertSelection swaps selected for unselected", () => {
    useStudioStore.setState({
      placements: [makePlacement("p1"), makePlacement("p2"), makePlacement("p3")],
      features: [],
      photoElevations: [],
      selection: [{ kind: "placement", id: "p1" }],
    });
    useStudioStore.getState().invertSelection();
    const sel = useStudioStore.getState().selection;
    expect(sel).toHaveLength(2);
    expect(sel.find((r) => r.id === "p1")).toBeUndefined();
    expect(sel.find((r) => r.id === "p2")).toBeDefined();
    expect(sel.find((r) => r.id === "p3")).toBeDefined();
  });

  it("invertSelection includes photo strokes with elevationId", () => {
    useStudioStore.setState({
      placements: [],
      features: [],
      photoElevations: [makePhotoElevation("e1", ["s1", "s2"])],
      selection: [{ kind: "photoStroke", id: "s1", elevationId: "e1" }],
    });
    useStudioStore.getState().invertSelection();
    const sel = useStudioStore.getState().selection;
    expect(sel).toHaveLength(1);
    expect(sel[0]!.id).toBe("s2");
    expect(sel[0]!.elevationId).toBe("e1");
  });

  it("selectAll selects all placements + features + photo strokes", () => {
    useStudioStore.setState({
      placements: [makePlacement("p1"), makePlacement("p2")],
      features: [makeFeature("f1")],
      photoElevations: [makePhotoElevation("e1", ["s1"])],
    });
    useStudioStore.getState().selectAll();
    const sel = useStudioStore.getState().selection;
    expect(sel).toHaveLength(4);
    expect(sel.filter((r) => r.kind === "placement")).toHaveLength(2);
    expect(sel.filter((r) => r.kind === "feature")).toHaveLength(1);
    expect(sel.filter((r) => r.kind === "photoStroke")).toHaveLength(1);
  });

  it("selectAll deduplicates", () => {
    useStudioStore.setState({
      placements: [makePlacement("p1")],
      features: [],
      photoElevations: [],
    });
    useStudioStore.getState().selectAll();
    useStudioStore.getState().selectAll();
    expect(useStudioStore.getState().selection).toHaveLength(1);
  });

  it("invertSelection with empty doc + empty selection = empty", () => {
    useStudioStore.getState().invertSelection();
    expect(useStudioStore.getState().selection).toHaveLength(0);
  });
});
