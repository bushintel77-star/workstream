import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
} from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Quote is a right-lane rail, not a mode takeover. It must open even when
 * the BOM has no priced lines — otherwise the Quote tab looks dead.
 */
test.describe("Quote live-cost rail", () => {
  test("Quote tab opens empty live-cost rail once CAD unlocks", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    // Strokes unlock CAD/Quote without priced catalog lines (empty BOM).
    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [],
          strokes: [
            {
              id: "a0000000-0000-4000-8000-00000000e301",
              points: [
                { x_pct: 40, y_pct: 50 },
                { x_pct: 55, y_pct: 52 },
                { x_pct: 58, y_pct: 60 },
              ],
              color: "#1c1917",
              width_px: 2,
            },
          ],
          site_frame: {
            boundary: [
              { x_pct: 18, y_pct: 16 },
              { x_pct: 82, y_pct: 16 },
              { x_pct: 82, y_pct: 84 },
              { x_pct: 18, y_pct: 84 },
            ],
            building: [
              { x_pct: 28, y_pct: 22 },
              { x_pct: 62, y_pct: 22 },
              { x_pct: 62, y_pct: 48 },
              { x_pct: 28, y_pct: 48 },
            ],
            building_source: "traced",
          },
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    const quoteTab = page.getByTestId("canvas-mode-quote");
    await expect(quoteTab).toBeEnabled({ timeout: 15_000 });
    await quoteTab.click();

    const rail = page.getByTestId("live-cost-rail");
    await expect(rail).toBeVisible({ timeout: 10_000 });
    await expect(rail).toHaveAttribute("data-stage", "empty");
    await expect(page.getByTestId("live-cost-rail-empty")).toBeVisible();
    await expect(page.getByTestId("right-data-lane-quote")).toBeVisible();
  });

  test("Cmd+K Open quote summons the rail", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);
    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [],
          strokes: [
            {
              id: "a0000000-0000-4000-8000-00000000e302",
              points: [
                { x_pct: 42, y_pct: 48 },
                { x_pct: 50, y_pct: 55 },
              ],
              color: "#1c1917",
              width_px: 2,
            },
          ],
          site_frame: {
            boundary: [
              { x_pct: 18, y_pct: 16 },
              { x_pct: 82, y_pct: 16 },
              { x_pct: 82, y_pct: 84 },
              { x_pct: 18, y_pct: 84 },
            ],
            building: [
              { x_pct: 28, y_pct: 22 },
              { x_pct: 62, y_pct: 22 },
              { x_pct: 62, y_pct: 48 },
              { x_pct: 28, y_pct: 48 },
            ],
            building_source: "traced",
          },
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 30_000,
    });

    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("open quote");
    await page.getByTestId("canvas-command-quote").click();
    await expect(page.getByTestId("live-cost-rail")).toBeVisible({
      timeout: 10_000,
    });
  });
});
