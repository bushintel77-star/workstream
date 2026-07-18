import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { LEGACY_STUDIO_VIEWPORT, pipelineShell } from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

test.describe("Design studio (sketch mode)", () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Design Studio, 42 Test Grove, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string } };
    projectId = body.project.id;

    const survey = await request.post(`${API}/projects/${projectId}/survey`);
    expect(survey.ok()).toBeTruthy();

    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [
            {
              id: randomUUID(),
              symbol_id: "bluestone-paver",
              x_pct: 40,
              y_pct: 40,
              rotation_deg: 0,
              scale: 1,
            },
          ],
          strokes: [],
          irrigation_zones: [],
        },
      },
    );
    expect(seed.ok()).toBeTruthy();
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(LEGACY_STUDIO_VIEWPORT);
  });

  test("loads sketch mode on one canvas without pipeline chrome", async ({
    page,
  }) => {
    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(pipelineShell(page)).toHaveCount(0);
    await expect(page.getByTestId("site-canvas")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("canvas-mode-strip")).toBeVisible();
    await expect(page.getByTestId("canvas-sketch-host")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("design-studio-canvas")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("design-studio-counts")).toHaveText(
      /1 symbols/,
      { timeout: 15_000 },
    );
  });

  test("legacy /design redirects into sketch mode", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design`);
    await expect(page).toHaveURL(
      new RegExp(`/projects/${projectId}\\?mode=sketch`),
    );
    await expect(page.getByTestId("design-studio-canvas")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("shows indicative scale bar on canvas", async ({ page }) => {
    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(page.getByTestId("design-studio-scale-bar")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("design-studio-scale-bar")).toContainText(/m/);
  });

  test("places symbol from catalog click", async ({ page }) => {
    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(page.getByTestId("design-studio-counts")).toHaveText(
      /1 symbols/,
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: "Place", exact: true }).click();
    await expect(page.getByTestId("design-asset-palette")).toBeVisible();
    await expect(page.getByTestId("catalog-bluestone-paver")).toBeVisible();
  });
});
