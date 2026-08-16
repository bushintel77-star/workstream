import { expect, test, type Page } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";

async function openSketch(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}?svg=1&mode=sketch`);
  await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("zoom-world")).toBeVisible({ timeout: 15_000 });
}

test.describe("Compact canvas-first chrome", () => {
  test("375: sheet + FAB + strip, no dual rails; 960: desktop rails", async ({
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
    await expect(page.getByTestId("undo-filmstrip")).toHaveCount(0);
    // Idle parchment — tools summoned only (canvas-first).
    await expect(page.getByTestId("contextual-tool-strip")).toHaveCount(0);
    await expect(page.getByTestId("artboard-strip")).toHaveCount(0);
    await expect(page.getByTestId("phase-manager")).toHaveCount(0);
    await expect(page.getByTestId("instruments-peek")).toBeVisible();
    await page.getByTestId("instruments-peek").click();
    await expect(page.getByTestId("contextual-tool-strip")).toBeVisible();
    await expect(page.getByTestId("instruments-peek")).toHaveCount(0);
    await expect(page.getByTestId("canvas-tool-trace")).toBeVisible();
    await expect(page.getByTestId("canvas-mode-overflow")).toBeVisible();

    await page.getByTestId("studio-primary-fab").click();
    const sheet = page.getByTestId("studio-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("data-snap", "half");
    await expect(sheet).toHaveAttribute("data-page", "assets");
    await expect(page.getByTestId("studio-sheet-tabs")).toBeVisible();
    await expect(page.getByTestId("studio-sheet-tab-assets")).toBeVisible();
    await expect(page.getByTestId("studio-sheet-tab-data")).toBeVisible();
    await expect(page.getByTestId("asset-swatch-row")).toBeVisible();
    await expect(page.getByTestId("asset-command-sheet-search")).toBeVisible();

    const underZoom = page.locator(
      '[data-testid="zoom-world"] [data-camera-chrome]',
    );
    await expect(underZoom).toHaveCount(0);

    await page.setViewportSize({ width: 960, height: 800 });
    await openSketch(page, projectId);
    await expect(handoffStudio(page)).toHaveAttribute("data-compact", "0");
    // Desktop activity-bar dock is ambient chrome (persistent), not summon-gated.
    await expect(page.getByTestId("tool-dock")).toBeVisible();
    await expect(page.getByTestId("contextual-tool-strip")).toHaveCount(0);
    // Desktop fork — no phone FAB / bottom sheet chrome.
    await expect(page.getByTestId("studio-primary-fab")).toHaveCount(0);
    await expect(page.getByTestId("studio-sheet")).toHaveCount(0);
    await expect(page.getByTestId("instruments-peek")).toHaveCount(0);
  });

  test.describe("phone CAD sheet", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("375 CAD Data sheet embeds live cost", async ({ page, request }) => {
      const { projectId } = await createSurveyProject(request);
      await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
      await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
      await expect(handoffStudio(page)).toHaveAttribute("data-compact", "1", {
        timeout: 15_000,
      });

      await page.getByTestId("studio-primary-fab").click();
      await expect(page.getByTestId("studio-sheet-tab-assets")).toBeVisible();
      await expect(page.getByTestId("studio-sheet-tab-data")).toBeVisible();
      await expect(page.getByTestId("studio-sheet-tab-inbox")).toBeVisible();
      await expect(page.getByTestId("studio-sheet-tab-command")).toHaveCount(0);
      await expect(page.getByTestId("studio-sheet-tab-share")).toHaveCount(0);
      await page.getByTestId("studio-sheet-tab-data").click();
      await expect(page.getByTestId("studio-sheet-data")).toBeVisible();
      await expect(page.getByTestId("studio-sheet-live-bom")).toBeVisible();
      await expect(page.getByTestId("live-bom-hud")).toBeVisible();
    });
  });
});
