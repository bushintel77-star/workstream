import { expect, test } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";

/**
 * Camera parenting gate — viewport chrome must not ride `.zoomWorld` scale.
 */
test.describe("Canvas chrome outside camera", () => {
  test("sketch toolbar stays viewport-fixed while zoomWorld scales", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("sketch-board")).toBeVisible({
      timeout: 30_000,
    });

    const bar = page.getByTestId("sketch-convert-bar");
    await expect(bar).toBeVisible({ timeout: 15_000 });

    const parenting = await bar.evaluate((el) => {
      const zoom = document.querySelector('[data-testid="zoom-world"]');
      const board = document.querySelector('[data-testid="studio-board"]');
      return {
        inZoomWorld: Boolean(zoom && zoom.contains(el)),
        inBoard: Boolean(board && board.contains(el)),
      };
    });
    expect(parenting.inZoomWorld).toBe(false);
    expect(parenting.inBoard).toBe(true);

    const before = await bar.boundingBox();
    expect(before).toBeTruthy();

    const board = page.getByTestId("studio-board");
    const box = await board.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, 900);
    await page.mouse.wheel(0, 900);

    const transform = await page
      .getByTestId("zoom-world")
      .evaluate((el) => getComputedStyle(el).transform);
    const scaleMatch = /matrix\(([^,]+)/.exec(transform);
    expect(scaleMatch).toBeTruthy();
    expect(Number(scaleMatch![1])).toBeLessThan(0.95);

    const after = await bar.boundingBox();
    expect(after).toBeTruthy();
    // Viewport chrome — must not shrink/travel with the scaled world.
    expect(Math.abs(after!.width - before!.width)).toBeLessThan(8);
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(8);
  });
});
