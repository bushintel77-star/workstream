import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createAddressProject } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * ARIA graphics tree e2e (AEC-2026 rollout Wave 4 — WAI-ARIA Graphics
 * Module, WCAG 2.2). The off-screen mirror tree
 * (CanvasFirstLayout Module 3) is the canvas's accessible surface:
 *
 *   1. The drawing surface carries the graphics-document semantics
 *      (aria-roledescription layered on the role="application" keyboard
 *      contract).
 *   2. Placed assets surface as treeitems with aria-roledescription
 *      "graphics symbol" and HUMAN labels (catalog label, not raw ids).
 */

test.describe("ARIA graphics tree", () => {
  test("placements surface as labelled graphics symbols in the mirror tree", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const { projectId } = await createAddressProject(request, {
      address: "1 Aria Graphics Street, Melbourne VIC 3000",
    });

    const seed = await request.put(`${API}/projects/${projectId}/design-canvas`, {
      data: {
        placements: [
          {
            id: randomUUID(),
            symbol_id: "olive-standard",
            x_pct: 40,
            y_pct: 45,
            rotation_deg: 0,
            scale: 1,
          },
          {
            id: randomUUID(),
            symbol_id: "tree-canopy",
            x_pct: 55,
            y_pct: 55,
            rotation_deg: 0,
            scale: 1,
            height_m: 8,
            canopy_radius_m: 3,
          },
        ],
        strokes: [],
        irrigation_zones: [],
        site_frame: {
          boundary: [
            { x_pct: 20, y_pct: 15 },
            { x_pct: 80, y_pct: 15 },
            { x_pct: 80, y_pct: 85 },
            { x_pct: 20, y_pct: 85 },
          ],
          easements: [],
          services: [],
          levels: [],
        },
      },
    });
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 15_000,
    });

    // 1. The drawing surface announces as a graphics document.
    const canvasLayer = page.locator('[data-cf-layer="canvas"]');
    await expect(canvasLayer).toHaveAttribute(
      "aria-roledescription",
      "design drawing canvas",
    );

    // 2. The mirror tree carries the site frame + the placements: the
    //    title boundary as a graphics OBJECT (2026-08-29 — the keyboard
    //    engine's Home key now lands on the boundary; click-selection
    //    parity for a11y), then the placements as graphics symbols with
    //    human labels — the catalog label when known ("Olive standard"),
    //    the symbol id as the honest fallback ("tree-canopy").
    const treeitems = page.locator('[data-cf-mirror] li[role="treeitem"]');
    await expect(treeitems).toHaveCount(3, { timeout: 15_000 });
    await expect(treeitems).toContainText([
      "Title boundary",
      "Olive standard",
      "tree-canopy",
    ]);
    const roledescriptions = await treeitems.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("aria-roledescription")),
    );
    expect(roledescriptions).toEqual([
      "graphics object",
      "graphics symbol",
      "graphics symbol",
    ]);
  });
});
