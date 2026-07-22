import { expect, test } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";
import path from "node:path";
import fs from "node:fs";

/**
 * Two-zoom screenshot pack per mode for camera-chrome sign-off.
 * Artifacts land under e2e/artifacts/camera-chrome-shots/ (outside Playwright's
 * cleaned test-results/ outputDir).
 */

const OUT = path.join(__dirname, "artifacts", "camera-chrome-shots");

async function shot(
  page: import("@playwright/test").Page,
  name: string,
) {
  fs.mkdirSync(OUT, { recursive: true });
  const dest = path.join(OUT, `${name}.png`);
  await page.screenshot({
    path: dest,
    fullPage: false,
  });
  if (!fs.existsSync(dest)) {
    throw new Error(`screenshot missing after write: ${dest}`);
  }
}

async function zoomOut(page: import("@playwright/test").Page, ticks: number) {
  const board = page.getByTestId("studio-board");
  const box = await board.boundingBox();
  if (!box) throw new Error("no board");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < ticks; i++) await page.mouse.wheel(0, 600);
}

async function zoomIn(page: import("@playwright/test").Page, ticks: number) {
  const board = page.getByTestId("studio-board");
  const box = await board.boundingBox();
  if (!box) throw new Error("no board");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < ticks; i++) await page.mouse.wheel(0, -600);
}

test.describe("Camera chrome screenshot pack", () => {
  test("two zoom levels × Sketch / CAD / Survey / Fit / Elevation", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    // Sketch
    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("sketch-convert-bar")).toBeVisible({
      timeout: 15_000,
    });
    await shot(page, "sketch-zoom-near");
    await zoomOut(page, 3);
    await shot(page, "sketch-zoom-far");
    expect(
      await page.locator('[data-testid="zoom-world"] [data-camera-chrome]').count(),
    ).toBe(0);

    // CAD
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 15_000,
    });
    await zoomIn(page, 2);
    await shot(page, "cad-zoom-near");
    await zoomOut(page, 4);
    await shot(page, "cad-zoom-far");
    expect(
      await page.locator('[data-testid="zoom-world"] [data-camera-chrome]').count(),
    ).toBe(0);

    // Survey
    await page.goto(`/projects/${projectId}?mode=survey`);
    await expect(page.getByTestId("zoom-world")).toBeVisible({ timeout: 15_000 });
    await zoomIn(page, 2);
    await shot(page, "survey-zoom-near");
    await zoomOut(page, 4);
    await shot(page, "survey-zoom-far");

    // Fit sheet
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(page.getByTestId("fit-sheet-top")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("fit-sheet-top").click();
    await expect(page.getByTestId("fit-sheet-layer")).toBeVisible({
      timeout: 15_000,
    });
    await shot(page, "fit-zoom-a");
    await zoomOut(page, 2);
    await shot(page, "fit-zoom-b");

    // Elevation (no zoomWorld)
    await page.goto(`/projects/${projectId}?mode=elevation`);
    await expect(page.getByTestId("elevation-profile")).toBeVisible({
      timeout: 15_000,
    });
    await shot(page, "elevation-a");
    await shot(page, "elevation-b");
  });
});
