import { expect, test, type Page } from "@playwright/test";
import { createSurveyProject, pipelineShell } from "./helpers";

async function openCommandPalette(page: Page) {
  await page.getByTestId("sketch-ribbon-cmd").evaluate((el) => {
    (el as HTMLButtonElement).click();
  });
  await expect(page.getByTestId("canvas-command-palette")).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("Canvas sketch AI", () => {
  test("shows AI ghost suggestions on empty sketch", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(page.getByTestId("sketch-instrument")).toBeVisible({
      timeout: 30_000,
    });
    await expect(pipelineShell(page)).toHaveCount(0);
    await expect(page.getByTestId("sketch-ghost-suggestion").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("accepts AI ghost suggestion onto canvas", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(page.getByTestId("sketch-ghost-suggestion").first()).toBeVisible({
      timeout: 20_000,
    });

    await page
      .getByTestId("sketch-ghost-suggestion")
      .first()
      .getByTestId("sketch-ghost-accept")
      .evaluate((el) => {
        (el as HTMLButtonElement).click();
      });

    await expect(page.getByTestId("canvas-placement")).toHaveCount(1, {
      timeout: 15_000,
    });
  });

  test("command palette opens with AI and scan commands", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(page.getByTestId("sketch-instrument")).toBeVisible({
      timeout: 30_000,
    });

    await openCommandPalette(page);
    await expect(page.getByTestId("canvas-command-scan-ghosts")).toBeVisible();
    await expect(page.getByTestId("canvas-command-ask-assist")).toBeVisible();
    await expect(page.getByTestId("canvas-command-toggle-shade")).toBeVisible();
  });

  test("command palette arms symbol from search", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(page.getByTestId("sketch-instrument")).toBeVisible({
      timeout: 30_000,
    });

    await openCommandPalette(page);
    await page.getByLabel("Search commands and materials").fill("arm bluestone");
    await expect(
      page.getByRole("option", { name: /Arm Bluestone paver/i }),
    ).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("sketch-instrument")).toHaveAttribute(
      "data-armed",
      "1",
    );
  });

  test("toggles sun/shade overlay from layer rail", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(page.getByTestId("sketch-instrument")).toBeVisible({
      timeout: 30_000,
    });

    await page
      .getByTestId("canvas-layer-toggles")
      .getByLabel("Sun/shade")
      .check();
    await expect(page.getByTestId("site-intelligence-overlay")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("sun-shade-controls")).toBeVisible({
      timeout: 10_000,
    });
  });
});
