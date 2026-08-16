import { expect, test } from "@playwright/test";
import { createSurveyProject, handoffStudio, openCommandPalette } from "./helpers";

test.describe("Board ink legend", () => {
  test("View menu summons legend with plan ink rows", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("header-view-menu").click();
    await expect(page.getByTestId("header-view-menu-panel")).toBeVisible();
    await page.getByTestId("board-ink-legend-top").click({ force: true });

    const legend = page.getByTestId("board-ink-legend");
    await expect(legend).toBeVisible({ timeout: 10_000 });
    await expect(legend.locator('[data-ink="existing"]')).toBeVisible();
    await expect(legend.locator('[data-ink="proposed"]')).toBeVisible();
    await expect(legend.locator('[data-ink="byda-water"]')).toBeVisible();

    await page.getByTestId("board-ink-legend-close").click();
    await expect(legend).toHaveCount(0);
  });

  test("command palette can open ink legend", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 30_000,
    });

    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("ink legend");
    const cmd = page.getByTestId("canvas-command-ink-legend");
    await expect(cmd).toBeVisible();
    await cmd.click();
    await expect(page.getByTestId("board-ink-legend")).toBeVisible({
      timeout: 10_000,
    });
  });
});
