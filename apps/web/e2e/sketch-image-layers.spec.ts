import { expect, test } from "@playwright/test";
import { createSurveyProject } from "./helpers";
import path from "node:path";

const SAMPLE_IMAGE = path.join(
  __dirname,
  "screenshots",
  "cards-decluttered-night.png",
);

test.describe("Sketch image layers", () => {
  test("operator can insert an image underlay and draw over it", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(page.getByTestId("sketch-board")).toBeVisible({
      timeout: 30_000,
    });

    // Open the image layers panel.
    await page.getByTestId("sketch-image").click();
    await expect(page.getByTestId("right-data-lane-image-layers")).toBeVisible();

    // Upload a sample image.
    const fileInput = page.getByTestId("image-layer-upload");
    await fileInput.setInputFiles(SAMPLE_IMAGE);

    // The image appears on the board.
    await expect(page.getByTestId("image-layer-slot")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('img[data-testid^="image-layer-"]')).toHaveCount(1);

    // Save before reload so the image layer persists.
    await page.getByTestId("autosave-tick").click();
    await expect(page.getByTestId("autosave-tick")).toHaveAttribute(
      "data-status",
      "saved",
      { timeout: 15_000 },
    );

    // Re-arm the pen and draw a stroke on top of the image.
    await page.getByTestId("sketch-pen").click();
    await expect(page.getByTestId("sketch-board")).toHaveAttribute(
      "data-active",
      "true",
    );

    const board = page.getByTestId("studio-board");
    const bb = await board.boundingBox();
    if (!bb) throw new Error("studio board has no bounding box");
    const cx = bb.x + bb.width / 2;
    const cy = bb.y + bb.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 40, { steps: 5 });
    await page.mouse.up();

    await expect(page.locator('[data-testid="sketch-board"] svg path')).toHaveCount(1);

    // A second sketch tab reload keeps the image layer.
    await page.reload();
    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(page.getByTestId("image-layer-slot")).toBeVisible({
      timeout: 15_000,
    });
  });
});
