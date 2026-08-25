import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createAddressProject } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Scan-choreographed hydration e2e (category-aware site-truth reveal).
 *
 * Seeds boundary + dwelling + two trees, arms the `gs-scan-reveal` flag the
 * import sets before its reload, and verifies:
 *   1. the overlay mounts post-reload with the REAL choreography stages in
 *      order (cadastre → parcels → flora — no services/terrain: absent
 *      categories never appear, zero-mock law);
 *   2. the reveal settles: overlay unmounts and the site entities
 *      (A2-6 canopy chip reading the trees) are live.
 */

const RING = [
  { x_pct: 20, y_pct: 15 },
  { x_pct: 80, y_pct: 15 },
  { x_pct: 80, y_pct: 85 },
  { x_pct: 20, y_pct: 85 },
];

const BUILDING = [
  { x_pct: 35, y_pct: 20 },
  { x_pct: 65, y_pct: 20 },
  { x_pct: 65, y_pct: 35 },
  { x_pct: 35, y_pct: 35 },
];

async function seedCanvas(request: APIRequestContext, projectId: string) {
  const res = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: {
      placements: [
        {
          id: randomUUID(),
          symbol_id: "tree-canopy",
          x_pct: 40,
          y_pct: 60,
          rotation_deg: 0,
          scale: 1,
          height_m: 8,
          canopy_radius_m: 3,
        },
        {
          id: randomUUID(),
          symbol_id: "tree-canopy",
          x_pct: 55,
          y_pct: 65,
          rotation_deg: 0,
          scale: 1,
          height_m: 9,
          canopy_radius_m: 3.5,
        },
      ],
      strokes: [],
      irrigation_zones: [],
      site_frame: {
        boundary: RING,
        building: BUILDING,
        building_source: "traced",
        easements: [],
        services: [],
        levels: [],
        board_width_m: 20,
      },
    },
  });
  expect(res.ok(), "seed design-canvas").toBeTruthy();
}

test.describe("Scan-choreographed site-truth reveal", () => {
  test("stages run in category order and settle into live entities", async ({
    page,
    request,
  }) => {
    test.setTimeout(150_000);
    const { projectId } = await createAddressProject(request, {
      address: "1 Scan Reveal Street, Melbourne VIC 3000",
    });
    await seedCanvas(request, projectId);

    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("gs-scan-reveal", "1");
      } catch {
        // best effort — the reveal simply won't run
      }
    });

    await page.goto(`/projects/${projectId}?mode=survey`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 15_000,
    });

    // 1. The overlay is up with the real, ordered choreography stages.
    const overlay = page.getByTestId("ai-scan-overlay-import");
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    const stageIds = await overlay.evaluate((el) =>
      Array.from(el.querySelectorAll("[data-testid]"))
        .map((n) => n.getAttribute("data-testid"))
        .filter((id): id is string => id != null),
    );
    expect(stageIds).toEqual(["scan-stage-cadastre", "scan-stage-parcels", "scan-stage-flora"]);

    // 2. The reveal settles — overlay unmounts and the entities are live
    //    (the canopy chip reads the two seeded trees).
    await expect(overlay).toHaveCount(0, { timeout: 15_000 });
    const chip = page.getByTestId("meta-chip-a26-canopy");
    await expect(chip).toBeVisible({ timeout: 15_000 });
    await expect(chip).toHaveText(/2\/\d+ canopy trees/);
  });
});
