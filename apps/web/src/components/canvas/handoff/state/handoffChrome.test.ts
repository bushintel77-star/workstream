import { describe, expect, it } from "vitest";
import { resolveHandoffChrome, resolveTopHint } from "./handoffChrome";

const base = {
  tool: "select" as const,
  focusOn: false,
  frameOn: false,
  clientView: false,
};

describe("resolveTopHint", () => {
  it("prefers trace over edit and tilt", () => {
    expect(
      resolveTopHint({
        tool: "trace",
        vectorEditHint: true,
        tiltPauseHint: true,
      }),
    ).toBe("trace");
  });

  it("suppresses tilt while the vector edit banner is showing", () => {
    expect(
      resolveTopHint({
        tool: "select",
        vectorEditHint: true,
        tiltPauseHint: true,
      }),
    ).toBe("edit");
  });

  it("shows tilt when no edit or trace hint", () => {
    expect(
      resolveTopHint({
        tool: "select",
        vectorEditHint: false,
        tiltPauseHint: true,
      }),
    ).toBe("tilt");
  });
});

describe("resolveHandoffChrome", () => {
  it("hides Live BOM and floating consumer docks in Sketch", () => {
    const c = resolveHandoffChrome({ ...base, mode: "sketch" });
    expect(c.liveBom).toBe(false);
    expect(c.utilityDrawer).toBe(false);
    expect(c.aiSidecar).toBe(false);
    expect(c.structureRail).toBe(true);
    expect(c.horizon).toBe(false);
    expect(c.aiCoach).toBe(false);
    expect(c.sunGrowth).toBe(false);
    expect(c.draftSurface).toBe(false);
  });

  it("hides Live BOM in Survey", () => {
    const c = resolveHandoffChrome({ ...base, mode: "survey" });
    expect(c.liveBom).toBe(false);
    expect(c.utilityDrawer).toBe(false);
    expect(c.sunGrowth).toBe(false);
    expect(c.draftSurface).toBe(false);
  });

  it("keeps idle CAD canvas-first — no parked data lane until summoned", () => {
    const c = resolveHandoffChrome({ ...base, mode: "cad" });
    expect(c.liveBom).toBe(true);
    // Canvas-first: measures / quantity lane is summoned, not parked.
    expect(c.utilityDrawer).toBe(false);
    expect(c.aiSidecar).toBe(false);
    expect(c.structureRail).toBe(true);
    expect(c.horizon).toBe(false);
    expect(c.volumeIsolith).toBe(false);
    expect(c.tradeMargin).toBe(false);
    expect(c.aiCoach).toBe(false);
    expect(c.sunGrowth).toBe(false);
    expect(c.lightingWorkspace).toBe(false);
    expect(c.selectionRing).toBe(true);
    expect(c.inventoryPopup).toBe(false);
    expect(c.draftSurface).toBe(false);
  });

  it("surfaces lighting workspace dock when summoned in CAD", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      lightingWorkspaceOn: true,
    });
    expect(c.lightingWorkspace).toBe(true);
  });

  it("summons the data lane in CAD when the AI/command core asks", () => {
    const c = resolveHandoffChrome({ ...base, mode: "cad", dataSummoned: true });
    expect(c.utilityDrawer).toBe(true);
    expect(c.aiSidecar).toBe(true);
    // Summoning never resurrects the legacy floating consumer docks.
    expect(c.aiCoach).toBe(false);
    expect(c.tradeMargin).toBe(false);
  });

  it("never opens a separate inventory frost popup (unified AssetPanel)", () => {
    expect(
      resolveHandoffChrome({ ...base, mode: "cad", tool: "add" }).inventoryPopup,
    ).toBe(false);
    expect(
      resolveHandoffChrome({ ...base, mode: "cad", tool: "paint" })
        .inventoryPopup,
    ).toBe(false);
    expect(
      resolveHandoffChrome({ ...base, mode: "cad", tool: "select" }).inventoryPopup,
    ).toBe(false);
  });

  it("surfaces sun scrubber when shade mesh is on", () => {
    const c = resolveHandoffChrome({ ...base, mode: "cad", shadeOn: true });
    expect(c.sunGrowth).toBe(true);
    expect(c.aiCoach).toBe(false);
  });

  it("keeps sun scrubber off Fit sheet even with shade mesh", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      shadeOn: true,
      frameOn: true,
    });
    expect(c.sunGrowth).toBe(false);
  });

  it("keeps sun scrubber in client presentation when shade is armed", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      shadeOn: true,
      clientView: true,
    });
    expect(c.sunGrowth).toBe(true);
    expect(c.utilityDrawer).toBe(false);
    expect(c.selectionRing).toBe(false);
  });

  it("hides sun scrubber in client presentation when shade is off", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      shadeOn: false,
      clientView: true,
    });
    expect(c.sunGrowth).toBe(false);
  });

  it("opens draft surface only while ghosts are pending", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      pendingGhosts: 3,
    });
    expect(c.draftSurface).toBe(true);
    expect(c.utilityDrawer).toBe(false);
    expect(c.sunGrowth).toBe(false);
    expect(c.floraRing).toBe(false);
    expect(c.horizon).toBe(false);
  });

  it("summons Flora Ring only while a planting session is active", () => {
    expect(
      resolveHandoffChrome({ ...base, mode: "cad" }).floraRing,
    ).toBe(false);
    expect(
      resolveHandoffChrome({
        ...base,
        mode: "cad",
        floraSessionActive: true,
      }).floraRing,
    ).toBe(true);
    expect(
      resolveHandoffChrome({
        ...base,
        mode: "cad",
        floraSessionActive: true,
        clientView: true,
      }).floraRing,
    ).toBe(false);
  });

  it("summons horizon only when foresight cards exist", () => {
    expect(
      resolveHandoffChrome({ ...base, mode: "cad" }).horizon,
    ).toBe(false);
    expect(
      resolveHandoffChrome({
        ...base,
        mode: "cad",
        horizonCardCount: 2,
      }).horizon,
    ).toBe(true);
    expect(
      resolveHandoffChrome({
        ...base,
        mode: "sketch",
        horizonCardCount: 1,
      }).horizon,
    ).toBe(true);
  });

  it("collapses utility while Trace is armed", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      tool: "trace",
    });
    expect(c.collapseUtility).toBe(true);
    expect(c.horizon).toBe(false);
    expect(c.selectionRing).toBe(true);
  });

  it("Quote keeps estimate path without draw chrome", () => {
    const c = resolveHandoffChrome({ ...base, mode: "quote" });
    expect(c.liveBom).toBe(true);
    expect(c.utilityDrawer).toBe(false);
    expect(c.drawTools).toBe(false);
    expect(c.horizon).toBe(false);
  });

  it("Share hides Live BOM and draw tools", () => {
    const c = resolveHandoffChrome({ ...base, mode: "share" });
    expect(c.liveBom).toBe(false);
    expect(c.utilityDrawer).toBe(false);
    expect(c.drawTools).toBe(false);
    expect(c.horizon).toBe(false);
    expect(c.aiCoach).toBe(false);
  });

  it("Fit sheet is paper-only — no Isolith, trade, or ribbon", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      frameOn: true,
    });
    expect(c.utilityDrawer).toBe(false);
    expect(c.horizon).toBe(false);
    expect(c.aiCoach).toBe(false);
    expect(c.volumeIsolith).toBe(false);
    expect(c.tradeMargin).toBe(false);
    expect(c.ambientRibbon).toBe(false);
    expect(c.draftSurface).toBe(false);
  });

  it("Focus mode clears ambient chrome for a single composition", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      focusOn: true,
    });
    expect(c.ambientRibbon).toBe(false);
    expect(c.volumeIsolith).toBe(false);
    expect(c.floraRing).toBe(false);
    expect(c.draftSurface).toBe(false);
  });

  it("Stage 1 title overlay stays monograph — no floating coach", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      foundationCleanse: true,
    });
    expect(c.volumeIsolith).toBe(false);
    expect(c.tradeMargin).toBe(false);
    expect(c.aiCoach).toBe(false);
    expect(c.floraRing).toBe(false);
    expect(c.draftSurface).toBe(false);
  });

  it("compact fork demotes rails into sheet + FAB", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      compact: true,
      horizonCardCount: 2,
    });
    expect(c.compact).toBe(true);
    expect(c.structureRail).toBe(false);
    expect(c.ambientRibbon).toBe(false);
    expect(c.studioSheet).toBe(true);
    expect(c.primaryFab).toBe(true);
    expect(c.contextualStrip).toBe(true);
    expect(c.horizon).toBe(true);
    expect(c.horizonBoard).toBe(false);
    expect(c.inboxSheet).toBe(true);
    expect(c.utilityDrawer).toBe(false);
  });

  it("compact keeps desktop horizon board off even when cards exist", () => {
    const desk = resolveHandoffChrome({
      ...base,
      mode: "cad",
      horizonCardCount: 1,
    });
    expect(desk.horizonBoard).toBe(true);
    expect(desk.inboxSheet).toBe(false);
    expect(desk.primaryFab).toBe(false);
  });

  it("compact Fit / focus still suppress sheet chrome", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      compact: true,
      frameOn: true,
    });
    expect(c.studioSheet).toBe(false);
    expect(c.primaryFab).toBe(false);
    expect(c.horizonBoard).toBe(false);
  });
});
