import { expect, test } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";

/**
 * Mechanically testable items from the STUDIO-STYLING-AND-UX.md §6 pre-merge
 * checklist. That checklist is binding ("answer yes to every item or do not
 * merge") but it lived only in markdown, and the revision history at the bottom
 * of that doc shows the drift cycle repeating: a spec written in response to
 * drift, then more drift. These are the items that can be an assertion rather
 * than a reviewer's judgement call.
 *
 * Covered here:
 *   1. Idle CAD shows mostly drawing, with no fixed inventory bar.
 *   5. Idle CAD left edge shows ONE tool dock — no zoom column, glyph stack, or
 *      duplicate Undo/Redo floating beside it.
 *
 * Item 7 (Layers left + AI/measures right, both collapsed by default) is
 * deliberately NOT probed here: the right data lane has no stable testid in the
 * collapsed state, so any assertion would be inferred from geometry and would
 * pass for the wrong reason. Logged in OUTSTANDING.md rather than faked.
 */

type Box = { id: string; x: number; y: number; w: number; h: number };

/** Every visibly-rendered testid with its viewport box. */
async function visibleBoxes(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const out: { id: string; x: number; y: number; w: number; h: number }[] = [];
    for (const el of Array.from(document.querySelectorAll("[data-testid]"))) {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (
        r.width > 0 &&
        r.height > 0 &&
        st.visibility !== "hidden" &&
        st.display !== "none" &&
        Number(st.opacity) > 0.05
      ) {
        out.push({
          id: el.getAttribute("data-testid") ?? "",
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
        });
      }
    }
    return out;
  });
}

/**
 * Layers that legitimately span the board: the drawing itself, its render
 * surfaces, and the full-viewport portal roots that hold chrome without
 * painting anything. Everything else spanning the plan is a bar over the
 * artwork, which is the thing §6 item 1 forbids.
 */
const BOARD_SPANNING_ALLOWED = new Set([
  "handoff-design-studio",
  "studio-frame-root",
  "studio-board",
  "zoom-world",
  "cad-plan-board",
  "draft-grid",
  "zone-overlay",
  "tactile-ground",
  "parchment-bleed",
  "aerial-image-slot",
  "annotation-layer",
  "survey-annotation-layer",
  "ground-ruler-overlay",
  "camera-chrome-root",
  "camera-chrome-shell",
  "canvas-context-card-chrome",
  "canvas-header-rail-chrome",
  "canvas-top-border-chrome",
  "phase-manager-chrome",
  "tool-dock-chrome",
  "vic-gov-status-chrome",
  "frame-drawer-artboards",
  "frame-drawer-site-meta",
  "foundation-title-boundary",
]);

async function openIdleCad(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
) {
  const { projectId } = await createSurveyProject(request);
  await page.goto(`/projects/${projectId}?mode=cad`);
  await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("cad-plan-board")).toBeVisible({
    timeout: 20_000,
  });
  // Settle: chrome that auto-dismisses should have gone by now. No pointer
  // input — "idle" means the operator has not touched anything yet.
  await page.waitForTimeout(3_000);
  return projectId;
}

test.describe("STUDIO-STYLING-AND-UX §6 — idle canvas", () => {
  test("item 1: no fixed bar sits across the idle drawing", async ({
    page,
    request,
  }) => {
    await openIdleCad(page, request);
    const boxes = await visibleBoxes(page);
    const board = boxes.find((b) => b.id === "studio-board");
    expect(board, "studio-board must be present").toBeTruthy();

    // A "bar over the drawing" = wide, inside the board vertically, and not one
    // of the render/portal layers that legitimately span it.
    const bars = boxes.filter(
      (b: Box) =>
        !BOARD_SPANNING_ALLOWED.has(b.id) &&
        b.w > board!.w * 0.6 &&
        b.y >= board!.y - 1 &&
        b.y + b.h <= board!.y + board!.h + 1,
    );
    expect(
      bars.map((b) => `${b.id} ${Math.round(b.w)}x${Math.round(b.h)}`),
      "idle CAD must show the drawing, not a fixed bar across it",
    ).toEqual([]);

    // The inventory is a summoned popup, never parked chrome.
    for (const id of [
      "kit-inventory",
      "inventory-popup",
      "niche-tool-carousel",
      "instrument-carousel",
      "ambient-ribbon",
      "instrument-hub",
    ]) {
      await expect(page.getByTestId(id)).toHaveCount(0);
    }
  });

  test("item 5: exactly one tool dock on the idle left edge", async ({
    page,
    request,
  }) => {
    await openIdleCad(page, request);
    const boxes = await visibleBoxes(page);

    const docks = boxes.filter((b: Box) => b.id === "tool-dock");
    expect(docks, "exactly one tool dock").toHaveLength(1);
    const dock = docks[0]!;
    expect(dock.x, "the dock owns the left edge").toBeLessThan(60);

    // Nothing else may form a second control column beside it: another tall
    // element hugging the left edge is the glyph stack / zoom column the
    // checklist calls out by name.
    const rivals = boxes.filter(
      (b: Box) =>
        b.id !== "tool-dock" &&
        !b.id.startsWith("canvas-tool-") &&
        !BOARD_SPANNING_ALLOWED.has(b.id) &&
        b.x < dock.x + dock.w + 24 &&
        b.h > 150,
    );
    expect(
      rivals.map((b) => `${b.id} @${Math.round(b.x)},${Math.round(b.y)}`),
      "no second control column beside the tool dock",
    ).toEqual([]);

    // Undo/redo must not be duplicated alongside the dock. The undo filmstrip
    // is allowed to exist, but not stacked next to the tools.
    const undoNextToDock = boxes.filter(
      (b: Box) =>
        /undo|redo/.test(b.id) &&
        b.x < dock.x + dock.w + 24 &&
        b.y < dock.y + dock.h,
    );
    expect(
      undoNextToDock.map((b) => b.id),
      "no duplicate undo/redo beside the tool dock",
    ).toEqual([]);
  });
});
