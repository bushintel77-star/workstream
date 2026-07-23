import { expect, test } from "@playwright/test";
import { handoffStudio } from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

test.describe("Canvas foundation honesty", () => {
  test("real title without building never displays the demo footprint", async ({
    page,
    request,
  }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Empty Footprint, 18 Honest Lane, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string } };
    const projectId = body.project.id;

    const canvas = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [],
          strokes: [],
          irrigation_zones: [],
          site_frame: {
            boundary: [
              { x_pct: 12, y_pct: 12 },
              { x_pct: 88, y_pct: 12 },
              { x_pct: 88, y_pct: 88 },
              { x_pct: 12, y_pct: 88 },
            ],
            building: [],
            easements: [],
            services: [],
            levels: [],
          },
        },
      },
    );
    expect(canvas.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=survey`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("building-footprint")).toHaveCount(0);
    await expect(page.getByTestId("building-footprint-empty")).toContainText(
      "Existing dwelling outline unavailable",
      { timeout: 15_000 },
    );
    // Survey auto-opens the checklist in the right data lane; the compact
    // measures chip yields the corner while any lane occupant is open (lane
    // law) and returns once the lane is free.
    await expect(page.getByTestId("survey-checklist")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("canvas-measure-summary")).toHaveCount(0);
    await page.getByRole("button", { name: "Close checklist" }).click();
    await expect(page.getByTestId("canvas-measure-summary")).toBeVisible();
    await expect(
      page.getByTestId("canvas-measure-summary-building"),
    ).toContainText("Not traced");
    await expect(page.getByTestId("cad-title-area")).toBeVisible();
    await expect(page.getByTestId("cad-building-area")).toHaveCount(0);
  });

  test("CAD area labels and summary stay synced with measured geometry", async ({
    page,
    request,
  }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Measured Areas, 20 Honest Lane, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string } };
    const projectId = body.project.id;

    // Aerial unlocks CAD on the server; without survey, ?mode=cad clamps to survey.
    const survey = await request.post(`${API}/projects/${projectId}/survey`);
    expect(survey.ok()).toBeTruthy();

    const canvas = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [],
          strokes: [],
          irrigation_zones: [],
          site_frame: {
            boundary: [
              { x_pct: 10, y_pct: 10 },
              { x_pct: 90, y_pct: 10 },
              { x_pct: 90, y_pct: 90 },
              { x_pct: 10, y_pct: 90 },
            ],
            building: [
              { x_pct: 35, y_pct: 30 },
              { x_pct: 65, y_pct: 30 },
              { x_pct: 65, y_pct: 55 },
              { x_pct: 35, y_pct: 55 },
            ],
            easements: [],
            services: [],
            levels: [],
          },
        },
      },
    );
    expect(canvas.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("cad-plan-board")).toHaveAttribute(
      "data-mode",
      "cad",
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("cad-title-area")).toBeVisible();
    await expect(page.getByTestId("cad-building-area")).toBeVisible();
    await expect(page.getByTestId("cad-outdoor-area")).toBeVisible();

    const summary = page.getByTestId("canvas-measure-summary");
    await expect(summary).toHaveAttribute("data-mode", "cad");
    await summary.click();
    await expect(page.getByTestId("live-measures-rail")).toBeVisible();
    await expect(page.getByTestId("live-measure-building")).toBeVisible();
    await expect(page.getByTestId("live-measure-outdoor")).toBeVisible();
  });
});
