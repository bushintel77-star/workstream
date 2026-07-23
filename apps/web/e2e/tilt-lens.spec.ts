import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
} from "./helpers";
import path from "node:path";
import fs from "node:fs";

/**
 * Tilt lens — view-only axonometric preview.
 * Must keep gate C (zero data-camera-chrome under zoom-world).
 */

const OUT = path.join(__dirname, "artifacts", "camera-chrome-shots");

async function shot(page: import("@playwright/test").Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    fullPage: false,
  });
}

test.describe("Tilt lens", () => {
  test("chrome gate, no-edit while tilted, Esc exits, ctrl-drag snaps", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("zoom-world")).toBeVisible({
      timeout: 15_000,
    });

    await shot(page, "tilt-off");

    await openCommandPalette(page);
    await page.getByTestId("canvas-command-tilt-view").click();
    await expect(page.getByTestId("studio-board")).toHaveAttribute(
      "data-tilt",
      "1",
      { timeout: 5_000 },
    );

    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-camera-chrome]')
        .count(),
    ).toBe(0);

    await shot(page, "tilt-on");

    const board = page.getByTestId("cad-plan-board");
    const box = await board.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(
      box!.x + box!.width * 0.4,
      box!.y + box!.height * 0.4,
    );
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width * 0.55,
      box!.y + box!.height * 0.55,
      { steps: 8 },
    );
    await page.mouse.up();
    await expect(
      page.locator('[data-testid="studio-item"][data-selected="true"]'),
    ).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("studio-board")).toHaveAttribute(
      "data-tilt",
      "0",
      { timeout: 3_000 },
    );

    await page.keyboard.down("Control");
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2,
      box!.y + box!.height * 0.34,
      { steps: 3 },
    );
    await page.mouse.up();
    await page.keyboard.up("Control");
    await expect(page.getByTestId("studio-board")).toHaveAttribute(
      "data-tilt",
      "0",
      { timeout: 3_000 },
    );

    await page.keyboard.down("Control");
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2,
      box!.y + box!.height * 0.6,
      { steps: 12 },
    );
    await page.mouse.up();
    await page.keyboard.up("Control");
    await expect(page.getByTestId("studio-board")).toHaveAttribute(
      "data-tilt",
      "1",
      { timeout: 3_000 },
    );

    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-camera-chrome]')
        .count(),
    ).toBe(0);
  });

  test("true-3D building extrusion — roof lands above (not overlapping) the ground footprint", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    // Fixture a traced dwelling so the extrusion gate does not depend on
    // Vicmap building coverage (many CBD pins have title but no building).
    const canvas = await request.put(
      `${process.env.API_URL ?? "http://localhost:3001"}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [],
          strokes: [],
          irrigation_zones: [],
          site_frame: {
            boundary: [
              { x_pct: 20, y_pct: 15 },
              { x_pct: 80, y_pct: 15 },
              { x_pct: 80, y_pct: 85 },
              { x_pct: 20, y_pct: 85 },
            ],
            building: [
              { x_pct: 35, y_pct: 30 },
              { x_pct: 65, y_pct: 30 },
              { x_pct: 65, y_pct: 55 },
              { x_pct: 35, y_pct: 55 },
            ],
            building_source: "traced",
            easements: [],
            services: [],
            levels: [],
          },
        },
      },
    );
    expect(canvas.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("zoom-world")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("building-footprint")).toBeVisible({
      timeout: 20_000,
    });

    await openCommandPalette(page);
    await page.getByTestId("canvas-command-tilt-view").click();
    await expect(page.getByTestId("studio-board")).toHaveAttribute(
      "data-tilt",
      "1",
      { timeout: 5_000 },
    );

    // Regression guard for a real bug: CadPlanBoard's root previously had
    // `transform-style: flat`, silently zeroing every translateZ/matrix3d
    // extrusion descendant — the roof rendered flush with the ground
    // footprint (no elevation) despite tilt being "on". Assert the roof
    // face actually sits above the flat footprint on screen.
    const footprint = page.getByTestId("building-footprint");
    const roofLift = page.getByTestId("tilt-building-extrusion");
    const walls = page.getByTestId("tilt-building-walls");
    await expect(footprint).toBeVisible();
    await expect(roofLift).toBeVisible({ timeout: 10_000 });
    await expect(walls).toBeVisible();

    // Roof must be visibly elevated (higher on screen, smaller y) — not
    // collapsed onto the same plane as the ground footprint. Poll until the
    // 3D compositor settles (first paint can still be flat for a frame).
    await expect
      .poll(
        async () => {
          const footprintBox = await footprint.boundingBox();
          const roofBox = await roofLift.boundingBox();
          if (!footprintBox || !roofBox) return 0;
          return footprintBox.y - roofBox.y;
        },
        { timeout: 8_000 },
      )
      .toBeGreaterThan(10);

    // Wall/post quads exist (4 walls + 4 posts for a rectangular footprint).
    expect(await walls.locator("> div").count()).toBeGreaterThanOrEqual(4);
  });
});
