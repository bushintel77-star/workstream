import { expect, test, type Page } from "@playwright/test";
import { createAddressProject } from "./helpers";
import { randomUUID } from "node:crypto";

/** Prefer 127.0.0.1 — `localhost` can resolve to ::1 while the API binds IPv4. */
const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Idle chrome coverage over the drawing — "the drawing is the product", made
 * measurable. Restores the ratchet that `e2e/canvas-checklist-s6.spec.ts` held
 * until commit a265af7 deleted it with the SVG studio; `chromeCoveragePct` and
 * `COVERAGE_BASELINE` returned zero matches repo-wide from 2026-08-19, while
 * three docs still cited the number as live. Nothing measured board coverage in
 * between.
 *
 * A width test is not a substitute (the deleted spec's own item 1a/1b split):
 * no single element has to be a bar for a fifth of the drawing to be covered.
 *
 * ## Denominator — the projected title boundary
 *
 * The SVG era measured against `studio-board`. Metre-space has no board
 * element, so the drawing's extent is the projected title-boundary bounding
 * box, published by `BoundaryProjectionProbe` from inside the scene (same
 * `pctToWorld` → `Vector3.project` chain `MetaChipSet` uses). The canvas rect
 * is the documented fallback for a project with no boundary.
 *
 * ## Numerator — union of painted rects, deliberately broader than collision
 *
 * `webgl-chrome-collision.spec.ts` measures floating instruments against each
 * other. This measures everything that *paints over the drawing*, which
 * additionally includes the world-anchored annotations: the Vicmap meta chips
 * and the dimension labels. Rects are unioned on a 4px grid, never summed —
 * chip clusters contain their chips, so summing double-counts and can exceed
 * 100%.
 *
 * ## Baselines are a TWO-WAY ratchet
 *
 * Growth fails (a regression). So does a drop past the stale band: a win has to
 * be recorded here or it can be quietly given back later. The 2026-08-04 SVG
 * numbers (survey 4.1%) are NOT comparable — different studio, different
 * denominator, different chrome set — and are not carried over.
 */

/**
 * Measured 2026-08-22 at 1600x950 against the projected boundary box
 * (392x512px for the fixture lot). Top contributors at the time of measurement:
 *
 *   survey 2.9 — interaction-guidance 2.88%. Survey is essentially pure drawing
 *     now: the projection HUD is gone, dims are unarmed, and the estimation
 *     companion opens as a pill inside the right dock instead of a 320x600 card
 *     over the checklist. The single remaining contributor is the guidance line,
 *     which is also the only chip in the bottom slot now that the first-run
 *     hint was folded into it.
 *   sketch 3.0 — interaction-guidance 2.88%, viewport-transition-hud 0.09%.
 *   cad 7.8 — dim-label 3.13% (the ring CAD deliberately arms),
 *     interaction-guidance up to 4.60%, viewport-transition-hud 0.09%.
 *   quote 5.8 — dim-label 3.13%, interaction-guidance 2.56%, HUD 0.09%.
 *
 * The guidance line is measured between 2.56% and 4.60% depending on the mode's
 * detail text and whether the first-run control tail is still showing, so the
 * bands below have to absorb ~2pp of legitimate width variance. Baselines are
 * the observed maximum per mode.
 *
 * NOT comparable to the SVG-era numbers the deleted spec carried (survey 4.1%):
 * different studio, different chrome set, and a projected-boundary denominator
 * instead of a `studio-board` element.
 */
const COVERAGE_BASELINE: Record<string, number> = {
  survey: 2.9,
  sketch: 3.0,
  cad: 7.8,
  quote: 5.8,
};

/** Guidance-line width variance + rendering jitter; a regression is larger. */
const COVERAGE_TOLERANCE_PP = 2;
/** Drop beyond this means the baseline is stale and must be lowered. */
const COVERAGE_STALE_PP = 4;

/**
 * Everything that paints over the drawing. Structural where possible: the
 * chrome overlay is a sibling of the `<Canvas>`, so anything with a testid
 * inside it that actually paints is chrome. `data-gs-glass-card` catches the
 * paper cards, and the two annotation classes are named because they live in a
 * drei `<Html>` portal rather than the overlay div.
 */
const PAINTED_SELECTOR = [
  "[data-gs-glass-card]",
  "[data-testid='asset-dock']",
  "[data-testid='studio-tool-rail']",
  "[data-testid='nib-palette']",
  "[data-testid='viewport-transition-hud']",
  "[data-testid='controls-hint']",
  "[data-testid='interaction-guidance']",
  "[data-testid='workflow-guide']",
  "[data-testid='selection-chip']",
  "[data-testid='survey-locate-state']",
  "[data-testid='perimeter-tab-strip']",
  "[data-testid='project-identity']",
  "[data-testid='perimeter-panel']",
  "[data-testid='fit-sheet-card']",
  "[data-testid='fit-sheet-pill']",
  "[data-testid^='meta-chip-']",
  "[data-testid='dim-label']",
].join(", ");

interface Coverage {
  pct: number;
  denominator: "boundary" | "canvas";
  box: { x: number; y: number; w: number; h: number };
  top: string[];
}

async function chromeCoveragePct(
  page: Page,
  selector: string,
): Promise<Coverage> {
  return page.evaluate((sel: string) => {
    const canvasHost = document.querySelector('[data-testid="webgl-studio"]');
    const canvasRect = canvasHost?.getBoundingClientRect();
    const projected = window.__wsBoundaryBox;
    const usable =
      projected != null &&
      Number.isFinite(projected.width) &&
      Number.isFinite(projected.height) &&
      projected.width > 32 &&
      projected.height > 32;

    const board = usable
      ? {
          x: projected!.x,
          y: projected!.y,
          width: projected!.width,
          height: projected!.height,
        }
      : canvasRect
        ? {
            x: canvasRect.x,
            y: canvasRect.y,
            width: canvasRect.width,
            height: canvasRect.height,
          }
        : null;
    if (!board || board.width <= 0 || board.height <= 0) {
      return {
        pct: 0,
        denominator: "canvas" as const,
        box: { x: 0, y: 0, w: 0, h: 0 },
        top: [],
      };
    }

    /** Does the element paint anything, or is it a transparent wrapper? */
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

    const painted = Array.from(document.querySelectorAll(sel)).filter(paints);

    const CELL = 4;
    const cols = Math.ceil(board.width / CELL);
    const rows = Math.ceil(board.height / CELL);
    const grid = new Uint8Array(cols * rows);
    const contributions: Record<string, number> = {};

    for (const el of painted) {
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

    return {
      pct: ((covered * CELL * CELL) / boardArea) * 100,
      denominator: usable ? ("boundary" as const) : ("canvas" as const),
      box: {
        x: Math.round(board.x),
        y: Math.round(board.y),
        w: Math.round(board.width),
        h: Math.round(board.height),
      },
      top,
    };
  }, selector);
}

async function seedSite(
  request: import("@playwright/test").APIRequestContext,
  address: string,
) {
  const { projectId } = await createAddressProject(request, { address });
  const place = (symbol_id: string, x_pct: number, y_pct: number) => ({
    id: randomUUID(),
    symbol_id,
    x_pct,
    y_pct,
    rotation_deg: 0,
    scale: 1,
  });
  const seed = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: {
      placements: [
        place("olive-standard", 40, 45),
        place("bluestone-paver", 60, 55),
      ],
      strokes: [],
      irrigation_zones: [],
      site_frame: {
        boundary: [
          { x_pct: 15, y_pct: 10 },
          { x_pct: 85, y_pct: 10 },
          { x_pct: 85, y_pct: 90 },
          { x_pct: 15, y_pct: 90 },
        ],
        building: [
          { x_pct: 35, y_pct: 18 },
          { x_pct: 65, y_pct: 18 },
          { x_pct: 65, y_pct: 32 },
          { x_pct: 35, y_pct: 32 },
        ],
        building_source: "traced",
        easements: [],
        services: [],
        levels: [
          { x_pct: 25, y_pct: 25, z_m: 50.0, source: "authored" as const },
          { x_pct: 75, y_pct: 25, z_m: 49.8, source: "authored" as const },
          { x_pct: 25, y_pct: 75, z_m: 51.2, source: "authored" as const },
          { x_pct: 75, y_pct: 75, z_m: 51.0, source: "authored" as const },
        ],
      },
    },
  });
  expect(seed.ok()).toBeTruthy();
  return projectId;
}

test.describe("WebGL idle chrome coverage", () => {
  test("idle chrome coverage stays inside its per-mode ratchet", async ({
    page,
    request,
  }) => {
    test.setTimeout(420_000);
    const projectId = await seedSite(
      request,
      "5 Coverage Ratchet Street, Melbourne VIC 3000",
    );
    await page.setViewportSize({ width: 1600, height: 950 });

    const report: string[] = [];
    for (const mode of ["survey", "sketch", "cad", "quote"] as const) {
      await page.goto(`/projects/${projectId}?webgl=1&mode=${mode}`, {
        waitUntil: "networkidle",
      });
      await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
        timeout: 20_000,
      });
      // No pointer input — "idle" means the operator has not touched anything.
      // The wait also lets the camera spring settle, so the projected boundary
      // box is measured at rest rather than mid-transition.
      await page.waitForTimeout(5_000);

      const cov = await chromeCoveragePct(page, PAINTED_SELECTOR);
      const baseline = COVERAGE_BASELINE[mode]!;
      const detail = `${mode}: ${cov.pct.toFixed(2)}% vs baseline ${baseline}% (denominator=${cov.denominator} ${cov.box.w}x${cov.box.h} at ${cov.box.x},${cov.box.y})\n    ${cov.top.join("\n    ")}`;
      report.push(detail);

      expect
        .soft(
          cov.denominator,
          `${mode}: the projected boundary box was unusable, so coverage fell back to the canvas rect — the denominator is no longer the drawing`,
        )
        .toBe("boundary");
      expect
        .soft(
          cov.pct,
          `Chrome coverage GREW over the drawing.\n  ${detail}`,
        )
        .toBeLessThanOrEqual(baseline + COVERAGE_TOLERANCE_PP);
      expect
        .soft(
          cov.pct,
          `Chrome coverage IMPROVED past the stale band — lower the baseline so the win cannot be given back.\n  ${detail}`,
        )
        .toBeGreaterThanOrEqual(baseline - COVERAGE_STALE_PP);
    }
    console.log(`COVERAGE REPORT\n  ${report.join("\n  ")}`);
  });
});
