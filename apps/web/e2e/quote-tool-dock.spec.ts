import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

async function seedDesignCanvas(request: APIRequestContext, projectId: string) {
  const seed = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: {
      placements: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          symbol_id: "lawn",
          x_pct: 50,
          y_pct: 50,
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
  });
  expect(seed.ok()).toBeTruthy();
}

async function openQuote(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}?mode=quote`);
  await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
}

test.describe("Quote left ToolDock", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("ToolDock is visible in quote and a design tool exits to CAD", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await seedDesignCanvas(request, projectId);
    await openQuote(page, projectId);

    // Quote overlay is open and the left ToolDock is reachable.
    await expect(page.getByTestId("quote-builder")).toBeVisible();
    await expect(page.getByTestId("tool-dock")).toBeVisible();

    // Clicking the Select tool returns to CAD with the drawing visible.
    await page.getByTestId("canvas-tool-select").click();
    await expect(page.getByTestId("quote-builder")).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(page.getByTestId("zoom-world")).toBeVisible();
    await expect(page.getByTestId("canvas-mode-cad")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page).toHaveURL(/mode=cad/);
    await expect(page.getByTestId("tool-dock")).toBeVisible();
  });
});
