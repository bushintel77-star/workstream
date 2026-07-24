import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  expectToolDock,
  handoffStudio,
} from "./helpers";

/**
 * Design craft — unified asset panel (Fill rail → library → Path Grammar).
 * Camera chrome must stay outside zoom-world (gate C).
 */
test.describe("Canvas design craft", () => {
  test("unified asset panel morphs through path placement", async ({
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

    const panel = page.getByTestId("asset-panel");
    await expect(panel).toBeVisible({ timeout: 8_000 });
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await expect(page.getByTestId("kit-asset-dock")).toHaveCount(0);
    await expect(page.getByTestId("hardscape-craft-bar")).toHaveCount(0);

    await page.getByTestId("swatch-paving").click();
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await expect(page.getByTestId("asset-panel-expanded")).toBeVisible();
    await expect(page.getByTestId("kit-section-paving")).toBeVisible();
    await expect(page.getByTestId("kit-planting-filters")).toBeVisible();
    await expect(page.getByTestId("asset-pinned")).toBeVisible();

    await page.getByTestId("paint-swatch-paving").click();
    await expect(panel).toHaveAttribute("data-state", "placing");
    await expect(page.getByTestId("asset-panel-placing")).toBeVisible();
    await expect(page.getByTestId("asset-panel-expanded")).toHaveCount(0);
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

    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await expect(page.getByTestId("asset-panel-placing")).toHaveCount(0);
    await expect(page.getByTestId("asset-panel-expanded")).toHaveCount(0);

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
