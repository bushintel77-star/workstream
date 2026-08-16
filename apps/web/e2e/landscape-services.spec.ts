import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
} from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * AI lighting conduit + watering plan (agg drain or spray).
 */
test.describe("Landscape lighting & watering services", () => {
  test("Cmd+K propose services draws LV trench to house fit-off", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [
            {
              id: "55555555-5555-4555-8555-555555555555",
              symbol_id: "frenchdrain",
              x_pct: 42,
              y_pct: 70,
              rotation_deg: 0,
              scale: 1,
            },
            {
              id: "66666666-6666-4666-8666-666666666666",
              symbol_id: "frenchdrain",
              x_pct: 68,
              y_pct: 74,
              rotation_deg: 0,
              scale: 1,
            },
            {
              id: "77777777-7777-4777-8777-777777777777",
              symbol_id: "brass-uplight",
              x_pct: 62,
              y_pct: 58,
              rotation_deg: 0,
              scale: 1,
            },
            {
              id: "88888888-8888-4888-8888-888888888888",
              symbol_id: "path-spike-light",
              x_pct: 76,
              y_pct: 61,
              rotation_deg: 0,
              scale: 1,
            },
          ],
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
            drainage_runs: [],
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

    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("lighting watering");
    await page.getByTestId("canvas-command-propose-services").click();

    await expect(page.getByTestId("council-setback-tip")).toContainText(
      /fixture|LV trench|Landscape services/i,
      { timeout: 10_000 },
    );
    await expect(
      page.getByTestId("zone-path-lighting_conduit").first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("zone-house-fitoff").first()).toBeVisible();
    await expect(page.getByTestId("zone-path-agg_drain").first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId("council-setback-tip")).toContainText(/PoD/i);
  });
});
