import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  expectToolDock,
  handoffStudio,
} from "./helpers";

/**
 * Client meeting pack — schemes + print affordance + honesty caption.
 */
test.describe("Meeting pack", () => {
  test("client view exposes print + scheme thumbs + caption", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expectToolDock(page);

    await page.getByTestId("scheme-save").click();
    await expect(page.getByTestId("scheme-thumb-A")).toBeVisible({
      timeout: 5_000,
    });

    await page.getByTestId("client-view-top").click();
    await expect(page.getByTestId("studio-board")).toHaveAttribute(
      "data-client",
      "1",
      { timeout: 5_000 },
    );
    await expect(page.getByTestId("meeting-pack-print")).toBeVisible();
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
