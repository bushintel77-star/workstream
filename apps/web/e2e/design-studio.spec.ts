import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  handoffStudio,
  LEGACY_STUDIO_VIEWPORT,
  openCommandPalette,
  pipelineShell,
} from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

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

  test("loads sketch mode on the WebGL studio with mode tabs, no pipeline chrome", async ({
    page,
  }) => {
    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(pipelineShell(page)).toHaveCount(0);
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 30_000,
    });
    // The preserved 8-mode system renders as tabs on the default mount —
    // sketch is native to the WebGL studio.
    await expect(page.getByTestId("studio-mode-tabs")).toBeVisible();
    await expect(page.getByTestId("mode-tab-sketch")).toBeVisible();
  });

  test("legacy /design redirects into sketch mode", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design`);
    await expect(page).toHaveURL(
      new RegExp(`/projects/${projectId}\\?mode=sketch`),
    );
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 30_000,
    });
  });

  test("seeded placement visible in CAD", async ({ page }) => {
    await page.goto(`/projects/${projectId}?svg=1&mode=cad`); // classic vector board
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("studio-item")).toHaveCount(1, {
      timeout: 15_000,
    });
  });

  test("selecting a placed item shows a live shape readout", async ({ page }) => {
    await page.goto(`/projects/${projectId}?svg=1&mode=cad`); // classic vector board
    const item = page.getByTestId("studio-item").first();
    await expect(item).toBeVisible({ timeout: 30_000 });
    await item.click();
    const readout = page.getByTestId("selected-shape-readout");
    await expect(readout).toBeVisible({ timeout: 10_000 });
    await expect(readout).toContainText(/m²|m/);
  });

  test("arms symbol from command palette search", async ({ page }) => {
    await page.goto(`/projects/${projectId}?svg=1&mode=cad`); // classic vector board
    await expect(page.getByTestId("studio-item")).toHaveCount(1, {
      timeout: 30_000,
    });
    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("place bluestone");
    const armPaving = page.getByTestId("canvas-command-arm-paving");
    await expect(armPaving).toBeVisible();
    await armPaving.click();
    await expect(page.getByTestId("asset-panel-placing")).toBeVisible({
      timeout: 10_000,
    });
  });
});
