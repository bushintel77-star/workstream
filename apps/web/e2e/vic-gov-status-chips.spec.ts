import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  expectToolDock,
  handoffStudio,
} from "./helpers";

/**
 * Vic-gov status chip row — replaces stacked Env/Services/Site/Trees cards.
 */
test.describe("Vic-gov status chips", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("chip row mounts; Env opens environment panel", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expectToolDock(page);

    const row = page.getByTestId("vic-gov-status-chips");
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("header-vic-gov-status")).toHaveCount(0);
    await expect(page.getByTestId("vic-gov-status-chrome")).toBeVisible();
    await expect(row).toHaveAttribute("data-placement", "dock");
    await expect(page.getByTestId("sticky-meta-stack")).toHaveCount(0);
    await expect(page.getByTestId("vic-gov-chip-boundary")).toBeVisible();
    await expect(page.getByTestId("vic-gov-chip-easements")).toBeVisible();
    await expect(page.getByTestId("vic-gov-chip-byda")).toBeVisible();
    await expect(page.getByTestId("vic-gov-chip-environment")).toBeVisible();

    await page.getByTestId("vic-gov-chip-environment").click();
    await expect(page.getByTestId("right-data-lane-environment")).toBeVisible({
      timeout: 8_000,
    });

    await expect(
      page.locator('[data-testid="zoom-world"] [data-camera-chrome]'),
    ).toHaveCount(0);
  });
});
