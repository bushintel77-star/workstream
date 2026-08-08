import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  expectToolDock,
  handoffStudio,
} from "./helpers";

/**
 * Flora Ring must summon when planting Add opens a session (chrome un-gate).
 */
test.describe("Flora Ring un-gate", () => {
  test("planting Add shows Flora Ring outside zoom-world", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expectToolDock(page);

    await page.getByTestId("canvas-tool-add").click();
    await expect(page.getByTestId("asset-panel-expanded")).toBeVisible({
      timeout: 8_000,
    });
    await page.getByTestId("paint-swatch-canopy").click();

    const board = page.getByTestId("cad-plan-board");
    const box = await board.boundingBox();
    if (!box) throw new Error("cad plan board missing box");
    await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.58);

    await expect(page.getByTestId("flora-ring")).toBeVisible({
      timeout: 8_000,
    });
    await expect(
      page.locator('[data-testid="zoom-world"] [data-testid="flora-ring"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="zoom-world"] [data-camera-chrome]'),
    ).toHaveCount(0);
  });
});
