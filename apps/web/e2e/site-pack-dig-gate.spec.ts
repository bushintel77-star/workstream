import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
} from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Site pack panel + dig gate — no live Vicmap required.
 */
test.describe("Site pack dig gate", () => {
  test("Services lane shows dig gate; override unlocks", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [],
          strokes: [],
          irrigation_zones: [],
          site_frame: {
            boundary: [
              { x_pct: 15, y_pct: 12 },
              { x_pct: 85, y_pct: 12 },
              { x_pct: 85, y_pct: 88 },
              { x_pct: 15, y_pct: 88 },
            ],
            building: [
              { x_pct: 30, y_pct: 20 },
              { x_pct: 55, y_pct: 20 },
              { x_pct: 55, y_pct: 45 },
              { x_pct: 30, y_pct: 45 },
            ],
            easements: [],
            services: [],
            levels: [],
            byda_assets: [],
          },
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("vic-gov-chip-byda").click();
    await expect(page.getByTestId("right-data-lane-services")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("site-pack-panel")).toBeVisible();
    await expect(page.getByTestId("dig-gate")).toHaveAttribute(
      "data-unlocked",
      "false",
    );
    await expect(page.getByTestId("byda-pdf-tray")).toBeVisible();
    await expect(page.getByTestId("chase-byda")).toBeVisible();
    await expect(page.getByTestId("chase-council_drain")).toBeVisible();
    await expect(page.getByTestId("council-drain-template")).toBeVisible();

    await page.getByTestId("dig-override-btn").click();
    await expect(page.getByTestId("dig-gate")).toHaveAttribute(
      "data-unlocked",
      "true",
    );
  });

  test("Cmd+K lists Prepare site pack", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("prepare site pack");
    await expect(
      page.getByTestId("canvas-command-prepare-site-pack"),
    ).toBeVisible({ timeout: 5_000 });
  });
});
