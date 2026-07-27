import { expect, test, type Page } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";

async function openSketch(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}?mode=sketch`);
  await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("zoom-world")).toBeVisible({ timeout: 15_000 });
}

test.describe("Compact canvas-first chrome (Phase 1)", () => {
  test("375: sheet + FAB, no dual rails; 960: desktop rails", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    await page.setViewportSize({ width: 375, height: 812 });
    await openSketch(page, projectId);
    const studio = handoffStudio(page);
    await expect(studio).toHaveAttribute("data-compact", "1");
    await expect(page.getByTestId("studio-primary-fab")).toBeVisible();
    await expect(page.getByTestId("tool-dock")).toHaveCount(0);
    await expect(page.getByTestId("canvas-mode-overflow")).toBeVisible();

    await page.getByTestId("studio-primary-fab").click();
    await expect(page.getByTestId("studio-sheet")).toBeVisible();
    await expect(page.getByTestId("studio-sheet-tab-assets")).toBeVisible();
    await expect(page.getByTestId("studio-sheet-tab-data")).toBeVisible();

    const underZoom = page.locator(
      '[data-testid="zoom-world"] [data-camera-chrome]',
    );
    await expect(underZoom).toHaveCount(0);

    await page.setViewportSize({ width: 960, height: 800 });
    await openSketch(page, projectId);
    await expect(handoffStudio(page)).toHaveAttribute("data-compact", "0");
    await expect(page.getByTestId("tool-dock")).toBeVisible();
    await expect(page.getByTestId("studio-primary-fab")).toHaveCount(0);
  });
});
