import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
} from "./helpers";

/**
 * Cmd+K Develop site — ghosts + scheme/flora tip + Live BOM lane.
 */
test.describe("Develop site loop", () => {
  test("palette Develop site opens ghost review and council tip", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 15_000,
    });

    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("develop site");
    const cmd = page.getByTestId("canvas-command-develop-site");
    await expect(cmd).toBeVisible({ timeout: 5_000 });
    await cmd.click();

    await expect(page.getByTestId("council-setback-tip")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("council-setback-tip")).toContainText(
      /Develop loop/,
    );
    await expect(page.getByTestId("council-setback-tip")).toContainText(
      /Flora Ring/,
    );

    await expect(page.getByTestId("right-data-lane-measures")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("live-measures-rail")).toBeVisible({
      timeout: 10_000,
    });
  });
});
