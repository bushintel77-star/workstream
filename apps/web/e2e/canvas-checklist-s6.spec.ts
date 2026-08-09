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
 *   1a. No fixed bar sits across the idle drawing.
 *   1b. The idle canvas is *mostly drawing* — chrome coverage is measured as a
 *       percentage of the board and may only go down.
 *   5.  Idle CAD left edge shows ONE tool dock — no zoom column, glyph stack, or
 *       duplicate Undo/Redo floating beside it.
 *
 * 1a and 1b are separate clauses and need separate probes. A width test alone
 * passes happily while eight small cards accumulate over the plan, which is the
 * actual complaint: no single element is a bar, but a fifth of the drawing is
 * covered.
 *
 *   7.  Right data lane collapsed by default on idle survey — no panel open
 *       until the operator asks for one.
 *
 * Item 7 was deliberately NOT probed until the collapsed state got a stable
 * testid (right-data-lane-collapsed, committed separately). Before that, any
 * assertion would have been inferred from geometry and would have passed for
 * the wrong reason. See OUTSTANDING.md for the history.
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
  "tool-dock-chrome",
  "vic-gov-status-chrome",
  "frame-drawer-artboards",
  "frame-drawer-site-meta",
  "foundation-title-boundary",
  // Instant Planner plan-geometry hosts (transparent, pointer-events none).
  "instant-planner-chrome",
  "landscape-features-layer",
  "hero-feature-markers",
]);

/**
 * Idle chrome coverage over the drawing, as a percentage of the board.
 *
 * Measured 2026-08-04 at 1280x720 on a fresh survey project. These are a
 * ratchet: the gate fails when a mode goes UP, and equally when a mode drops
 * well below its number, which forces the gain to be recorded here so it cannot
 * be given back later.
 *
 * Survey started at 18.8%, dominated by right-data-lane-checklist (7.6%),
 * building-footprint-empty (2.5%) and the two Vicmap clusters (3.9% combined).
 *
 * 16.8 — the missing-dwelling cue stopped being a glass card at the optical
 * centre and became haloed ink on the lot's top edge, so it no longer paints.
 *
 * 9.4 — the right data lane stopped forcing the checklist open on every
 * survey load (§6 item 7). The checklist is now collapsed by default,
 * reachable via a "2/5" progress pill in the frame band. The pill lives in
 * the gallery frame and does not paint over the board, so the 7.57% the
 * checklist occupied is gone with no replacement. Remaining contributors:
 * the two Vicmap clusters (4.6% combined), utility-honesty-footer (1.8%),
 * header-context-strip (1.8%), phase-manager (0.7%).
 *
 * 4.8 (survey/cad) / 8.6 (sketch) — the VicGov chip clusters stopped
 * escaping their FrameDrawer. The chips used position: absolute to paint
 * at the frame corners regardless of whether the drawer was open, and
 * wrapped themselves in a nested CameraChrome that portalled out of the
 * drawer entirely. Switching to placement="header" (no CameraChrome) and
 * overriding the CSS to flow inside the drawer removed the 4.57% the two
 * clusters occupied. The drawer handles overflow with its own scrollbar.
 * Remaining survey contributors: utility-honesty-footer (1.8%),
 * header-context-strip (1.8%), phase-manager (0.7%).
 *
 * 4.1 (survey/cad) / 7.9 (sketch) — the floating PhaseManagerChip moved
 * into the header left zone (HeaderPhaseSelect), removing the 0.7% it
 * occupied over the board. Remaining survey contributors:
 * utility-honesty-footer (1.8%), header-context-strip (1.8%),
 * vic-gov chips (0.5%).
 */
const COVERAGE_BASELINE: Record<string, number> = {
  survey: 4.1,
  sketch: 7.9,
  cad: 4.1,
  elevation: 0.1,
};

/** Rendering jitter between runs; a real regression is far larger than this. */
const COVERAGE_TOLERANCE_PP = 0.75;
/** Drop beyond this means the baseline is stale and must be lowered. */
const COVERAGE_STALE_PP = 2;

/**
 * Union of painted chrome intersected with the board, as a percentage.
 *
 * Two things this deliberately does NOT do. It does not sum bounding boxes —
 * chip clusters contain their chips, so summing double-counts and can exceed
 * 100%. And it does not count every box, only those that actually paint:
 * `camera-chrome-root` and the other portal wrappers are transparent and
 * viewport-sized, so counting them would report ~100% on an empty canvas.
 *
 * Chrome is identified structurally rather than by an allowlist: anything under
 * `[data-camera-chrome]` and outside `zoom-world` is chrome by construction,
 * which is the same rule canvas-chrome-detector.spec.ts enforces.
 */
async function chromeCoveragePct(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const boardEl = document.querySelector('[data-testid="studio-board"]');
    if (!boardEl) return { pct: 0, top: [] as string[] };
    const board = boardEl.getBoundingClientRect();

    const paints = (el: Element) => {
      const st = getComputedStyle(el);
      if (st.visibility === "hidden" || st.display === "none") return false;
      if (Number(st.opacity) <= 0.05) return false;
      const bg = st.backgroundColor;
      const hasBg =
        Boolean(bg) &&
        bg !== "transparent" &&
        !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(bg);
      const hasImg = Boolean(st.backgroundImage) && st.backgroundImage !== "none";
      const hasBorder =
        parseFloat(st.borderTopWidth || "0") > 0 ||
        parseFloat(st.borderBottomWidth || "0") > 0 ||
        parseFloat(st.borderLeftWidth || "0") > 0 ||
        parseFloat(st.borderRightWidth || "0") > 0;
      const hasShadow = Boolean(st.boxShadow) && st.boxShadow !== "none";
      return hasBg || hasImg || hasBorder || hasShadow;
    };

    const world = document.querySelector('[data-testid="zoom-world"]');
    const chrome = Array.from(document.querySelectorAll("*")).filter((el) => {
      if (world && world.contains(el)) return false;
      if (!el.closest("[data-camera-chrome]")) return false;
      return paints(el);
    });

    const CELL = 4;
    const cols = Math.ceil(board.width / CELL);
    const rows = Math.ceil(board.height / CELL);
    const grid = new Uint8Array(cols * rows);
    const contributions: Record<string, number> = {};

    for (const el of chrome) {
      const r = el.getBoundingClientRect();
      const x0 = Math.max(board.x, r.x);
      const y0 = Math.max(board.y, r.y);
      const x1 = Math.min(board.x + board.width, r.x + r.width);
      const y1 = Math.min(board.y + board.height, r.y + r.height);
      if (x1 <= x0 || y1 <= y0) continue;
      let fresh = 0;
      for (
        let gy = Math.floor((y0 - board.y) / CELL);
        gy < Math.ceil((y1 - board.y) / CELL);
        gy++
      ) {
        for (
          let gx = Math.floor((x0 - board.x) / CELL);
          gx < Math.ceil((x1 - board.x) / CELL);
          gx++
        ) {
          const i = gy * cols + gx;
          if (i >= 0 && i < grid.length && !grid[i]) {
            grid[i] = 1;
            fresh += 1;
          }
        }
      }
      if (fresh > 0) {
        const id =
          el.getAttribute("data-testid") ??
          el.closest("[data-testid]")?.getAttribute("data-testid") ??
          el.tagName.toLowerCase();
        contributions[id] = (contributions[id] ?? 0) + fresh * CELL * CELL;
      }
    }

    let covered = 0;
    for (const c of grid) if (c) covered += 1;
    const boardArea = board.width * board.height;
    const top = Object.entries(contributions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, area]) => `${id} ${((area / boardArea) * 100).toFixed(2)}%`);

    return { pct: ((covered * CELL * CELL) / boardArea) * 100, top };
  });
}

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

  for (const mode of ["survey", "sketch", "cad", "elevation"] as const) {
    test(`item 1b: idle ${mode} stays mostly drawing`, async ({
      page,
      request,
    }) => {
      const { projectId } = await createSurveyProject(request);
      await page.goto(`/projects/${projectId}?mode=${mode}`);
      await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
      // No pointer input — "idle" means nothing has been touched yet.
      await page.waitForTimeout(4_000);

      const { pct, top } = await chromeCoveragePct(page);
      const baseline = COVERAGE_BASELINE[mode]!;
      const detail = `${pct.toFixed(2)}% vs baseline ${baseline}%\n  ${top.join("\n  ")}`;

      expect(
        pct,
        `idle ${mode} chrome coverage grew — chrome is taking the drawing back.\n  ${detail}`,
      ).toBeLessThanOrEqual(baseline + COVERAGE_TOLERANCE_PP);

      expect(
        pct,
        `idle ${mode} chrome coverage improved to ${pct.toFixed(2)}%. Lower COVERAGE_BASELINE.${mode} in this file so the gain is locked in.\n  ${detail}`,
      ).toBeGreaterThan(baseline - COVERAGE_STALE_PP);
    });
  }

  /**
   * Every right-data-lane panel testid. When the lane is collapsed, none of
   * these should be present and `right-data-lane-collapsed` should be.
   */
  const RIGHT_LANE_PANELS = [
    "checklist",
    "measures",
    "layers",
    "image-layers",
    "services",
    "environment",
    "site",
    "trees",
    "sites",
    "ghosts",
  ] as const;

  test("item 7: right data lane collapsed by default on idle survey", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=survey`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    // No pointer input — "idle" means nothing has been touched yet.
    await page.waitForTimeout(4_000);

    // The collapsed marker must be present — the lane is not open.
    await expect(
      page.getByTestId("right-data-lane-collapsed"),
      "right data lane must be collapsed on idle survey load",
    ).toHaveCount(1);

    // No panel testid may be present — nothing is open.
    for (const panel of RIGHT_LANE_PANELS) {
      await expect(
        page.getByTestId(`right-data-lane-${panel}`),
        `right-data-lane-${panel} must not be open on idle survey load`,
      ).toHaveCount(0);
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
