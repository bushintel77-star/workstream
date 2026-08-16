import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
  pipelineShell,
} from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Seed a lot frame so heuristic CAD layout can propose without waiting on
 * Vicmap WFS (CI runners often miss/timeout public GeoServer).
 */
async function seedLotFrameForScan(
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
) {
  const put = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: {
      placements: [],
      site_frame: {
        boundary: [
          { x_pct: 18, y_pct: 16 },
          { x_pct: 82, y_pct: 16 },
          { x_pct: 82, y_pct: 84 },
          { x_pct: 18, y_pct: 84 },
        ],
        building: [
          { x_pct: 28, y_pct: 22 },
          { x_pct: 62, y_pct: 22 },
          { x_pct: 62, y_pct: 48 },
          { x_pct: 28, y_pct: 48 },
        ],
        building_source: "traced",
      },
    },
  });
  expect(put.ok()).toBeTruthy();
}

/** A closed rectangle-ish stroke that the domain classifier reads as a bed
 * mass (closed, not near the boundary, area under the deck/lawn threshold). */
const CLOSED_BED_STROKE = {
  id: "a0000000-0000-4000-8000-00000000e2e1",
  points: [
    { x_pct: 42, y_pct: 55 },
    { x_pct: 58, y_pct: 55 },
    { x_pct: 58, y_pct: 65 },
    { x_pct: 42, y_pct: 65 },
    { x_pct: 42.5, y_pct: 55.5 },
  ],
  color: "#1c1917",
  width_px: 2,
};

test.describe("Canvas sketch AI", () => {
  test("sketch board mounts without pipeline chrome", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?svg=1&mode=sketch`);
    await expect(page.getByTestId("sketch-board")).toBeVisible({
      timeout: 30_000,
    });
    await expect(pipelineShell(page)).toHaveCount(0);
    await expect(handoffStudio(page)).toHaveAttribute(
      "data-canvas-mode",
      "sketch",
    );
  });

  test("command palette opens with scan and convert commands", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?svg=1&mode=sketch`);
    await expect(page.getByTestId("sketch-board")).toBeVisible({
      timeout: 30_000,
    });

    await openCommandPalette(page);
    await expect(page.getByTestId("canvas-command-scan-ghosts")).toBeVisible();
    await expect(
      page.getByTestId("canvas-command-convert-sketch"),
    ).toBeVisible();
  });

  test("command palette arms symbol from search", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 30_000,
    });

    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("place bluestone");
    const armPaving = page.getByTestId("canvas-command-arm-paving");
    await expect(armPaving).toBeVisible();
    await armPaving.click();
    await expect(page.getByTestId("asset-panel-placing")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("CAD scan produces reviewable ghosts", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);
    await seedLotFrameForScan(request, projectId);

    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("building-footprint")).toBeVisible({
      timeout: 15_000,
    });

    await openCommandPalette(page);
    const scan = page.getByTestId("canvas-command-scan-ghosts");
    await expect(scan).toBeVisible({ timeout: 10_000 });
    await scan.click();
    // Review and on-plan ghosts may both be visible; poll their combined count
    // instead of using locator.or(), which is strict when both valid surfaces land.
    await expect
      .poll(
        async () =>
          (await page.getByTestId("cad-ghost-review").count()) +
          (await page.getByTestId("studio-ghost").count()),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);
  });

  test("formalizing a closed stroke draws a sketch-region polygon (shape fidelity)", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    const put = await request.put(`${API}/projects/${projectId}/design-canvas`, {
      data: { placements: [], strokes: [CLOSED_BED_STROKE] },
    });
    expect(put.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 30_000,
    });

    await openCommandPalette(page);
    await page.getByTestId("canvas-command-convert-sketch").click();

    // The stroke's drawn outline should render as a filled/washed region —
    // not a rectangle glyph parked at the centroid (the shape-fidelity bug).
    await expect(page.getByTestId("sketch-region")).toHaveCount(1, {
      timeout: 20_000,
    });
    const region = page.getByTestId("sketch-region").first();
    await expect(region).toHaveAttribute("data-ghost", "1");

    // Accept the ghost — the region persists (solid) after acceptance.
    const ghost = page.getByTestId("studio-ghost").first();
    if (await ghost.count()) {
      await ghost.click();
      await page.keyboard.press("a");
    }
    await expect
      .poll(async () => page.getByTestId("sketch-region").count(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
  });

  test("Accept commits a pending ghost onto the board (no silent-write)", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await seedLotFrameForScan(request, projectId);

    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("building-footprint")).toBeVisible({
      timeout: 15_000,
    });

    await openCommandPalette(page);
    await page.getByTestId("canvas-command-scan-ghosts").click();

    const review = page.getByTestId("cad-ghost-review");
    await expect(review).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("studio-ghost").first()).toBeVisible({
      timeout: 15_000,
    });

    const beforeGhosts = await page.getByTestId("studio-ghost").count();
    const beforeLive = await page.getByTestId("studio-item").count();
    expect(beforeGhosts).toBeGreaterThan(0);

    await page.getByTestId("ghost-accept").click();
    await expect
      .poll(async () => page.getByTestId("studio-ghost").count(), {
        timeout: 15_000,
      })
      .toBeLessThan(beforeGhosts);
    await expect
      .poll(async () => page.getByTestId("studio-item").count(), {
        timeout: 15_000,
      })
      .toBeGreaterThan(beforeLive);
  });
});
