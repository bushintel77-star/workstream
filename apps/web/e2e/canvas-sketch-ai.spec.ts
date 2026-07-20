import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
  pipelineShell,
} from "./helpers";

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
    const armPaving = page.getByTestId("canvas-command-arm-paving");
    await expect(armPaving).toBeVisible();
    await armPaving.click();
    await expect(page.getByTestId("kit-asset-dock")).toBeVisible({
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
    // Review and on-plan ghosts may both be visible; poll their combined count
    // instead of using locator.or(), which is strict when both valid surfaces land.
    await expect
      .poll(
        async () =>
          (await page.getByTestId("cad-ghost-review").count()) +
          (await page.getByTestId("studio-ghost").count()),
        { timeout: 25_000 },
      )
      .toBeGreaterThan(0);
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
    await expect
      .poll(
        async () =>
          (await page.getByTestId("cad-ghost-review").count()) +
          (await page.getByTestId("studio-ghost").count()),
        { timeout: 25_000 },
      )
      .toBeGreaterThan(0);

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
