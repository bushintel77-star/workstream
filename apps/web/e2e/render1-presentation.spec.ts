import { expect, test } from "@playwright/test";
import {
  clickHeaderViewItem,
  createSurveyProject,
  handoffStudio,
} from "./helpers";
import path from "node:path";
import fs from "node:fs";

/**
 * Presentation linework (Render 1) screenshot pack — CAD / Fit A3 / night.
 * Artifacts: e2e/artifacts/camera-chrome-shots/render1-*.png
 */

const OUT = path.join(__dirname, "artifacts", "camera-chrome-shots");

async function shot(
  page: import("@playwright/test").Page,
  name: string,
) {
  fs.mkdirSync(OUT, { recursive: true });
  const dest = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: false });
  if (!fs.existsSync(dest)) {
    throw new Error(`screenshot missing after write: ${dest}`);
  }
}

test.describe("Render 1 presentation screenshots", () => {
  test("cad + fit a3 + night board", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 15_000,
    });
    await shot(page, "render1-cad");
    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-camera-chrome]')
        .count(),
    ).toBe(0);

    // Fit sheet A3
    await page.getByTestId("fit-sheet-top").click();
    await expect(page.getByTestId("fit-sheet-layer")).toBeVisible({
      timeout: 15_000,
    });
    const paperA3 = page
      .getByTestId("paper-size-control")
      .getByRole("button", { name: /^a3$/i });
    if (await paperA3.isVisible().catch(() => false)) {
      await paperA3.click();
    }
    await shot(page, "render1-fit-a3");
    await page.getByTestId("fit-sheet-top").click();

    // Night board
    await clickHeaderViewItem(page, "dark-canvas-top");
    await expect(page.getByTestId("cad-plan-board")).toBeVisible();
    await shot(page, "render1-night");
    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-camera-chrome]')
        .count(),
    ).toBe(0);
  });
});
