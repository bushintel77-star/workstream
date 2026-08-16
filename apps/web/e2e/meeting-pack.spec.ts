import { expect, test } from "@playwright/test";
import {
  clickHeaderViewItem,
  createSurveyProject,
  expectToolDock,
  handoffStudio,
  openCommandPalette,
} from "./helpers";

/**
 * Client meeting pack — schemes + print affordance + honesty caption.
 * Schemes strip is summoned after save (not parked on idle CAD).
 * Print lives inside the View menu in client view (not a parked header chip).
 */
test.describe("Meeting pack", () => {
  test("client view exposes print + scheme thumbs + caption", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expectToolDock(page);

    await expect(page.getByTestId("variation-filmstrip")).toHaveCount(0);
    await openCommandPalette(page);
    const palette = page.getByTestId("canvas-command-palette");
    await palette.getByRole("combobox").fill("save design scheme");
    const saveScheme = page.getByTestId("canvas-command-save-scheme");
    await expect(saveScheme).toBeVisible({ timeout: 10_000 });
    await saveScheme.click();
    await expect(page.getByTestId("scheme-thumb-A")).toBeVisible({
      timeout: 10_000,
    });

    await clickHeaderViewItem(page, "client-view-top");
    await expect(page.getByTestId("studio-board")).toHaveAttribute(
      "data-client",
      "1",
      { timeout: 5_000 },
    );

    // Re-open View — print is a menu item, not a headerTools sibling.
    const viewMenu = page.getByTestId("header-view-menu");
    await expect(viewMenu).toBeVisible({ timeout: 10_000 });
    await viewMenu.click();
    await expect(page.getByTestId("header-view-menu-panel")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId("meeting-pack-print")).toBeVisible({
      timeout: 5_000,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("client-meeting-caption")).toBeVisible();
    await expect(page.getByTestId("client-meeting-caption")).toContainText(
      "schemes A",
    );
    await expect(page.getByTestId("scheme-plan-A")).toBeVisible();
    await expect(
      page.locator('[data-testid="zoom-world"] [data-camera-chrome]'),
    ).toHaveCount(0);
  });
});
