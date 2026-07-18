import { expect, test } from "@playwright/test";
import { pipelineShell } from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

test.describe("One canvas modes", () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E One Canvas, 12 Shell Street, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string } };
    projectId = body.project.id;

    const survey = await request.post(`${API}/projects/${projectId}/survey`);
    expect(survey.ok()).toBeTruthy();
  });

  test("project root is site canvas with mode strip", async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByTestId("site-canvas")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("canvas-mode-strip")).toBeVisible();
    await expect(pipelineShell(page)).toHaveCount(0);
  });

  test("mode strip progressive disclosure unlocks after survey", async ({
    page,
  }) => {
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByTestId("canvas-mode-strip")).toBeVisible({
      timeout: 30_000,
    });
    // Aerial from beforeAll → Sketch + CAD unlocked; Quote/Share stay gated.
    await expect(page.getByTestId("canvas-mode-sketch")).toBeVisible();
    await expect(page.getByTestId("canvas-mode-cad")).toBeVisible();
    await expect(page.getByTestId("canvas-mode-quote")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await page.getByTestId("canvas-mode-cad").click();
    await expect(page).toHaveURL(/mode=cad/);
    await expect(page.getByTestId("site-canvas")).toHaveAttribute(
      "data-canvas-mode",
      "cad",
    );
  });

  test("legacy design route redirects into sketch mode", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design`);
    await expect(page).toHaveURL(
      new RegExp(`/projects/${projectId}\\?mode=sketch`),
    );
    await expect(page.getByTestId("site-canvas")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("legacy overview redirects into canvas", async ({ page }) => {
    await page.goto(`/projects/${projectId}/overview`);
    await expect(page).toHaveURL(
      new RegExp(`/projects/${projectId}\\?mode=cad`),
    );
    await expect(pipelineShell(page)).toHaveCount(0);
  });
});
