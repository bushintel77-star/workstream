import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  expectToolDock,
  handoffStudio,
} from "./helpers";

/**
 * Smart buildable envelope — high-stakes arm auto-shows laser;
 * pin persists across low-stakes tool switch; cursor outside remnant
 * surfaces setback violation chip.
 */
test.describe("Buildable area smart envelope", () => {
  test("deck arm shows laser; pin survives lawn; outside cursor violates", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("zoom-world")).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(async () => page.getByTestId("cad-plan-board").count(), {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);
    await expectToolDock(page);

    await expect(page.getByTestId("buildable-area-overlay")).toHaveCount(0);

    await page.getByTestId("canvas-tool-add").click();
    const panel = page.getByTestId("asset-panel");
    await expect(panel).toBeVisible({ timeout: 8_000 });
    await page.getByTestId("swatch-deck").click();
    await expect(page.getByTestId("paint-swatch-deck")).toBeVisible({
      timeout: 5_000,
    });
    await page.getByTestId("paint-swatch-deck").click();

    const overlay = page.getByTestId("buildable-area-overlay");
    await expect(overlay).toBeVisible({ timeout: 8_000 });
    await expect(overlay).toHaveAttribute("data-intensity", "auto");
    await expect(page.getByTestId("buildable-polygon").first()).toBeVisible();
    await expect(page.getByTestId("buildable-area-chip")).toBeVisible();

    await page.getByTestId("buildable-area-pin").click();
    await expect(overlay).toHaveAttribute("data-pinned", "1");
    await expect(overlay).toHaveAttribute("data-intensity", "full");

    // Low-stakes arm — pin keeps the laser up.
    await page.getByTestId("swatch-lawn").click();
    await page.getByTestId("paint-swatch-lawn").click();
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute("data-pinned", "1");

    const board = page.getByTestId("cad-plan-board");
    const box = await board.boundingBox();
    expect(box).toBeTruthy();
    // Warm the board pointer path first (chip sits top-left in CameraChrome).
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await expect
      .poll(
        async () =>
          page.getByTestId("buildable-area-chip").getAttribute("data-tone"),
        { timeout: 8_000 },
      )
      .toBe("ok");
    // Right edge past setback — avoid the left FILL panel (clears board cursor).
    await page.mouse.move(box!.x + box!.width * 0.99, box!.y + box!.height * 0.55);
    await expect
      .poll(
        async () =>
          page.getByTestId("buildable-area-chip").getAttribute("data-tone"),
        { timeout: 8_000 },
      )
      .toBe("danger");
    await expect(page.getByTestId("buildable-area-chip")).toContainText(
      /Setback violation/i,
    );
  });
});
