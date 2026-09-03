import { describe, it, expect, beforeEach } from "vitest";
import { useStudioStore, type CameraBookmark } from "./studioStore";

function reset() {
  useStudioStore.setState({
    viewpointVisibility: {},
    cameraBookmarks: [],
    sketchCanvases: [],
    hiddenCanvasIds: [],
  });
}

function makeCanvas(id: string, z: number) {
  return {
    id,
    label: `Canvas ${id}`,
    position: [0, z, 0] as [number, number, number],
    rotation: [0, 0, 0, 1] as [number, number, number, number],
    season_tag: "ALL" as const,
  };
}

function makeBookmark(id: string): CameraBookmark {
  return {
    id,
    position: [0, 5, 10],
    target: [0, 0, 0],
  };
}

describe("Phase J — per-viewpoint canvas visibility keyframing", () => {
  beforeEach(reset);

  it("toggleViewpointVisibility adds a canvas to a viewpoint's visible list", () => {
    useStudioStore.getState().toggleViewpointVisibility("vp1", "c1");
    expect(useStudioStore.getState().viewpointVisibility).toEqual({
      vp1: ["c1"],
    });
  });

  it("toggleViewpointVisibility removes a canvas from a viewpoint's list", () => {
    useStudioStore.getState().toggleViewpointVisibility("vp1", "c1");
    useStudioStore.getState().toggleViewpointVisibility("vp1", "c1");
    expect(useStudioStore.getState().viewpointVisibility).toEqual({
      vp1: [],
    });
  });

  it("toggleViewpointVisibility is independent per viewpoint", () => {
    useStudioStore.getState().toggleViewpointVisibility("vp1", "c1");
    useStudioStore.getState().toggleViewpointVisibility("vp2", "c2");
    const vis = useStudioStore.getState().viewpointVisibility;
    expect(vis.vp1).toEqual(["c1"]);
    expect(vis.vp2).toEqual(["c2"]);
  });

  it("toggleViewpointVisibility handles multiple canvases per viewpoint", () => {
    useStudioStore.getState().toggleViewpointVisibility("vp1", "c1");
    useStudioStore.getState().toggleViewpointVisibility("vp1", "c2");
    useStudioStore.getState().toggleViewpointVisibility("vp1", "c3");
    expect(useStudioStore.getState().viewpointVisibility.vp1).toEqual([
      "c1",
      "c2",
      "c3",
    ]);
    // Remove the middle one.
    useStudioStore.getState().toggleViewpointVisibility("vp1", "c2");
    expect(useStudioStore.getState().viewpointVisibility.vp1).toEqual([
      "c1",
      "c3",
    ]);
  });

  it("viewpointVisibility starts empty (no keyframes = all visible)", () => {
    expect(useStudioStore.getState().viewpointVisibility).toEqual({});
  });

  it("a viewpoint with no keyframe entry defaults to all-visible", () => {
    // Set a keyframe for vp1 but not vp2.
    useStudioStore.getState().toggleViewpointVisibility("vp1", "c1");
    const vis = useStudioStore.getState().viewpointVisibility;
    // vp2 has no entry — all canvases are visible there.
    expect(vis.vp2).toBeUndefined();
  });

  it("store state supports the visibility panel matrix (canvases + bookmarks + visibility)", () => {
    useStudioStore.setState({
      sketchCanvases: [makeCanvas("c1", 0), makeCanvas("c2", 4)],
      cameraBookmarks: [makeBookmark("vp1"), makeBookmark("vp2")],
    });
    useStudioStore.getState().toggleViewpointVisibility("vp1", "c1");
    const state = useStudioStore.getState();
    expect(state.sketchCanvases.length).toBe(2);
    expect(state.cameraBookmarks.length).toBe(2);
    expect(state.viewpointVisibility.vp1).toEqual(["c1"]);
    expect(state.viewpointVisibility.vp2).toBeUndefined();
  });
});
