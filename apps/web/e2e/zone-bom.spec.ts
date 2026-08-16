import { expect, test } from "@playwright/test";
import {
  handoffStudio,
  LEGACY_STUDIO_VIEWPORT,
  openCommandPalette,
} from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

test.describe("Authored zone BOM", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(LEGACY_STUDIO_VIEWPORT);
  });

  test("seeded drip zone appears and Advanced BOM can open", async ({
    page,
    request,
  }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Zone BOM, 7 Drip Lane, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string } };
    const projectId = body.project.id;

    const survey = await request.post(`${API}/projects/${projectId}/survey`);
    expect(survey.ok()).toBeTruthy();

    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [],
          strokes: [],
          irrigation_zones: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              name: "Rear lawn",
              kind: "drip",
              points: [
                { x_pct: 25, y_pct: 55 },
                { x_pct: 70, y_pct: 58 },
                { x_pct: 72, y_pct: 75 },
              ],
              emitter_spacing_cm: 30,
              emitter_flow_lph: 2,
            },
          ],
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("zone-path-drip").first()).toBeVisible({
      timeout: 15_000,
    });

    await openCommandPalette(page);
    await page.getByTestId("canvas-command-measures").click();
    await expect(page.getByTestId("utility-sheet-bom")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("live-bom-advanced").click();
    await expect(page.getByTestId("live-bom-advanced-body")).toContainText(
      /Drip|irrigation/i,
    );
  });
});
