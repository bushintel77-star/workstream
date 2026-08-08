import { expect, test } from "@playwright/test";
import {
  clickHeaderViewItem,
  createSurveyProject,
  handoffStudio,
} from "./helpers";

/**
 * Premium sun cast + client presentation theatre.
 * Chrome must stay outside zoom-world (gate C).
 */
test.describe("Premium sun + client", () => {
  test("shade arms live shadow + client keeps sun scrubber outside camera", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("zoom-world")).toBeVisible({
      timeout: 15_000,
    });

    await clickHeaderViewItem(page, "canvas-layers-top");
    const shadeToggle = page.getByTestId("layers-shade-toggle");
    await expect(shadeToggle).toBeVisible({ timeout: 10_000 });
    await shadeToggle.click();

    await expect(page.getByTestId("sun-shade-controls")).toBeVisible({
      timeout: 5_000,
    });
    await expect(
      page.locator('[data-testid="zoom-world"] [data-camera-chrome]'),
    ).toHaveCount(0);

    const dwellingShadow = page.getByTestId("dwelling-sun-shadow");
    if ((await dwellingShadow.count()) > 0) {
      await expect(dwellingShadow.first()).toHaveAttribute(
        "data-sun-live",
        "1",
      );
    }

    await clickHeaderViewItem(page, "client-view-top");
    await expect(page.getByTestId("studio-board")).toHaveAttribute(
      "data-client",
      "1",
      { timeout: 5_000 },
    );
    await expect(page.getByTestId("sun-shade-controls")).toBeVisible();
    await expect(
      page.getByTestId("client-presentation-caption"),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="zoom-world"] [data-camera-chrome]'),
    ).toHaveCount(0);
  });
});
