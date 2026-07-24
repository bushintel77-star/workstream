import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  expectToolDock,
  handoffStudio,
} from "./helpers";

/**
 * Design craft surfaces — hardscape grammar + scheme filmstrip.
 * Camera chrome must stay outside zoom-world (gate C).
 */
test.describe("Canvas design craft", () => {
  test("path grammar + scheme filmstrip stay outside camera", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("zoom-world")).toBeVisible({
      timeout: 15_000,
    });
    await expectToolDock(page);

    await page.getByTestId("canvas-tool-add").click();
    await expect(page.getByTestId("kit-asset-dock")).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByTestId("kit-planting-filters")).toBeVisible();
    // Draft kit opens by default — toggling the section head would close it.
    await page.getByTestId("paint-swatch-paving").click();

    await expect(page.getByTestId("hardscape-craft-bar")).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByTestId("path-width-1.2")).toBeVisible();
    await expect(page.getByTestId("edge-type-sawn")).toBeVisible();
    await expect(page.getByTestId("path-fillet-0.3")).toBeVisible();
    await expect(page.getByTestId("path-draw-begin")).toBeVisible();

    await page.getByTestId("path-draw-begin").click();
    const board = page.getByTestId("cad-plan-board");
    const box = await board.boundingBox();
    if (!box) throw new Error("cad plan board missing box");
    await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.55);
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55);
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.4);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("path-corridor").first()).toBeVisible({
      timeout: 5_000,
    });

    await expect(page.getByTestId("variation-filmstrip")).toBeVisible();
    await page.getByTestId("scheme-save").click();
    await expect(page.getByTestId("scheme-thumb-A")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId("scheme-plan-A")).toBeVisible();

    await expect(
      page.locator('[data-testid="zoom-world"] [data-camera-chrome]'),
    ).toHaveCount(0);
  });
});
