import { expect, test } from "@playwright/test";
import { createSurveyProject, openCommandPalette } from "./helpers";

test.describe("Cmd+K catalogue groups", () => {
  test("idle palette exposes AI · Site · BYDA · Design · View · Place", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 30_000,
    });

    await openCommandPalette(page);
    await expect(page.getByTestId("cmd-group-ai")).toBeVisible();
    await expect(page.getByTestId("cmd-group-site")).toBeVisible();
    await expect(page.getByTestId("cmd-group-byda")).toBeVisible();
    await expect(page.getByTestId("cmd-group-design")).toBeVisible();
    await expect(page.getByTestId("cmd-group-view")).toBeVisible();
    await expect(page.getByTestId("cmd-group-place")).toBeVisible();
  });
});
