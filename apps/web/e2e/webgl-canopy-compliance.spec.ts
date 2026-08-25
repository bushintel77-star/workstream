import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createAddressProject } from "./helpers";

/** Prefer 127.0.0.1 — `localhost` can resolve to ::1 while the API binds IPv4. */
const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * ResCode A2-6 canopy compliance e2e — the stage-threaded check
 * (docs/AEC-2026-ROLLOUT-PLAN.md Wave 2):
 *
 *   1. SURVEY baseline — the boundary alone (no design) surfaces the lot's
 *      canopy obligation: "0/N canopy trees" on the meta chip ring.
 *   2. CAD live assessment — seeded mature + immature trees read
 *      provided/required on the chip; the expanded detail carries the
 *      maturity callout and the standard identity, never a permit claim.
 *   3. QUOTE fit-sheet row — the itemized card carries the one-row A2-6
 *      summary stamped with the clause.
 */

const RING = [
  { x_pct: 20, y_pct: 15 },
  { x_pct: 80, y_pct: 15 },
  { x_pct: 80, y_pct: 85 },
  { x_pct: 20, y_pct: 85 },
];

async function putCanvas(
  request: APIRequestContext,
  projectId: string,
  placements: Array<Record<string, unknown>>,
) {
  const res = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: {
      placements,
      strokes: [],
      irrigation_zones: [],
      site_frame: {
        boundary: RING,
        easements: [],
        services: [],
        levels: [],
        // Board width 20 m → the 60×70% ring ≈ 196 m² → required = 2.
        board_width_m: 20,
      },
    },
  });
  expect(res.ok(), "seed design-canvas").toBeTruthy();
}

const matureTree = (x_pct: number, y_pct: number) => ({
  id: randomUUID(),
  symbol_id: "tree-canopy",
  x_pct,
  y_pct,
  rotation_deg: 0,
  scale: 1,
  height_m: 8,
  canopy_radius_m: 3,
});

test.describe("ResCode A2-6 canopy compliance (survey → cad → quote)", () => {
  test("the canopy obligation threads through the stages", async ({
    page,
    request,
  }) => {
    test.setTimeout(150_000);
    const { projectId } = await createAddressProject(request, {
      address: "1 Canopy Compliance Street, Melbourne VIC 3000",
    });

    // --- Stage 1: SURVEY baseline — boundary only, no design yet ----------
    await putCanvas(request, projectId, []);
    await page.goto(`/projects/${projectId}?mode=survey`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 15_000,
    });
    const chip = page.getByTestId("meta-chip-a26-canopy");
    await expect(chip).toBeVisible({ timeout: 15_000 });
    await expect(chip).toHaveText(/0\/\d+ canopy trees/);

    // --- Stage 2: CAD — mature + immature stock reads live ----------------
    await putCanvas(request, projectId, [
      matureTree(40, 50),
      matureTree(55, 50),
      // olive-standard: catalog 5 m mature height / 2.5 m spread — immature.
      {
        id: randomUUID(),
        symbol_id: "olive-standard",
        x_pct: 45,
        y_pct: 65,
        rotation_deg: 0,
        scale: 1,
      },
    ]);
    await page.goto(`/projects/${projectId}?mode=cad`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(chip).toBeVisible({ timeout: 15_000 });
    await expect(chip).toHaveText(/2\/\d+ canopy trees/);

    // The chip button carries the full assessment in its aria-label (the
    // expanded detail view renders on hover, but the perimeter solver parks
    // chips under the top chrome band where hover is intercepted) — assert
    // the standard identity, the maturity callout, and the honesty stamp
    // (never a permit claim) off the label.
    const aria = await chip.getAttribute("aria-label");
    expect(aria, "chip aria-label carries the assessment").toBeTruthy();
    expect(aria).toContain("1 placed below maturity minimums");
    expect(aria).toContain("Clause 54.02-6");
    expect(aria).toContain("not a permit or VicSmart eligibility claim");

    // --- Stage 3: QUOTE — one stamped row on the itemized card ------------
    await page.goto(`/projects/${projectId}?mode=quote`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 15_000,
    });
    const card = page.locator('[data-testid="fit-sheet-card"]');
    const pill = page.getByTestId("fit-sheet-pill");
    await expect(pill.or(card)).toBeVisible({ timeout: 15_000 });
    if (await pill.isVisible()) {
      await pill.click({ force: true });
    }
    await expect(card).toBeVisible({ timeout: 8_000 });

    const canopyRow = page.getByTestId("fit-sheet-canopy");
    await expect(canopyRow).toBeVisible({ timeout: 10_000 });
    await expect(canopyRow).toContainText("A2-6 Tree canopy");
    await expect(canopyRow).toContainText(/2\/\d+ mature · 54\.02-6/);
  });
});
