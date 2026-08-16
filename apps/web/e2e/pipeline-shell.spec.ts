import { expect, test } from "@playwright/test";
import { handoffStudio, pipelineShell } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

test.describe("One canvas modes", () => {
  // Operator viewport — the header (brand + phase + 8 mode tabs + actions)
  // is designed for ≥1600px; the Playwright default 1280 crams it off-screen.
  // Sub-1280 header layout is a tracked product issue, not this spec's law.
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 950 });
  });

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

  test("project root is handoff studio with mode strip", async ({ page }) => {
    await page.goto(`/projects/${projectId}?svg=1`);
    await expect(handoffStudio(page)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("canvas-mode-strip")).toBeVisible();
    await expect(pipelineShell(page)).toHaveCount(0);
  });

  test("mode strip switches Survey → Sketch → CAD", async ({ page }) => {
    // After survey job, empty `?mode=` suggests CAD — pin Survey first.
    await page.goto(`/projects/${projectId}?svg=1&mode=survey`);
    await expect(page.getByTestId("canvas-mode-strip")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("canvas-mode-survey")).toBeVisible();
    await expect(page.getByTestId("canvas-mode-sketch")).toBeVisible();
    await expect(page.getByTestId("canvas-mode-cad")).toBeVisible();
    await expect(handoffStudio(page)).toHaveAttribute(
      "data-canvas-mode",
      "survey",
    );

    await page.getByTestId("canvas-mode-sketch").click();
    await expect(page).toHaveURL(/mode=sketch/);
    await expect(handoffStudio(page)).toHaveAttribute(
      "data-canvas-mode",
      "sketch",
    );

    await page.getByTestId("canvas-mode-cad").click();
    await expect(page).toHaveURL(/mode=cad/);
    await expect(handoffStudio(page)).toHaveAttribute("data-canvas-mode", "cad");

    await page.getByTestId("canvas-mode-survey").click();
    await expect(page).toHaveURL(/mode=survey/);
    await expect(handoffStudio(page)).toHaveAttribute(
      "data-canvas-mode",
      "survey",
    );
  });

  test("legacy design route redirects into sketch mode", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design`);
    await expect(page).toHaveURL(
      new RegExp(`/projects/${projectId}\\?mode=sketch`),
    );
    // The redirect lands on the WebGL studio (the ?svg=1 board is the
    // explicit deep fallback) — same contract as design-studio.spec.ts.
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 30_000,
    });
  });

  test("legacy overview redirects into canvas", async ({ page }) => {
    await page.goto(`/projects/${projectId}/overview`);
    await expect(page).toHaveURL(
      new RegExp(`/projects/${projectId}\\?mode=sketch`),
    );
    await expect(pipelineShell(page)).toHaveCount(0);
  });
});
