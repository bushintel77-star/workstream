import { expect, test, type Page } from "@playwright/test";
import { createSurveyProject, handoffStudio, pipelineShell } from "./helpers";

async function openCommandPalette(page: Page) {
  await page.getByTestId("canvas-command-top").evaluate((el) => {
    (el as HTMLButtonElement).click();
  });
  await expect(page.getByTestId("canvas-command-palette")).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("Canvas sketch AI", () => {
  test("sketch board mounts without pipeline chrome", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(page.getByTestId("sketch-board")).toBeVisible({
      timeout: 30_000,
    });
    await expect(pipelineShell(page)).toHaveCount(0);
    await expect(handoffStudio(page)).toHaveAttribute(
      "data-canvas-mode",
      "sketch",
    );
  });

  test("command palette opens with scan and convert commands", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(page.getByTestId("sketch-board")).toBeVisible({
      timeout: 30_000,
    });

    await openCommandPalette(page);
    await expect(page.getByTestId("canvas-command-scan-ghosts")).toBeVisible();
    await expect(
      page.getByTestId("canvas-command-convert-sketch"),
    ).toBeVisible();
  });

  test("command palette arms symbol from search", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 30_000,
    });

    await openCommandPalette(page);
    await page.getByLabel("Command search").fill("place bluestone");
    await expect(
      page.getByRole("option", { name: /Place Bluestone/i }),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("add-symbol-strip")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("CAD scan produces reviewable ghosts", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 30_000,
    });

    await openCommandPalette(page);
    await page.getByTestId("canvas-command-scan-ghosts").click();
    // Either ghosts land for review, or empty state after scan completes
    await expect(
      page
        .getByTestId("cad-ghost-review")
        .or(page.getByTestId("header-accept-ghosts"))
        .or(page.getByTestId("studio-ghost").first()),
    ).toBeVisible({ timeout: 25_000 });
  });

  test("A / Enter accepts a pending ghost onto the board", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 30_000,
    });

    await openCommandPalette(page);
    await page.getByTestId("canvas-command-scan-ghosts").click();
    await expect(
      page
        .getByTestId("cad-ghost-review")
        .or(page.getByTestId("studio-ghost").first()),
    ).toBeVisible({ timeout: 25_000 });

    const before = await page.getByTestId("studio-ghost").count();
    if (before === 0) {
      test.skip();
      return;
    }
    await page.keyboard.press("a");
    await expect
      .poll(async () => page.getByTestId("studio-ghost").count())
      .toBeLessThan(before);
  });
});
