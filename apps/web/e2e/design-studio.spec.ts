import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const API = process.env.API_URL ?? "http://localhost:3001";

test.describe("Design studio", () => {
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

    const seed = await request.put(`${API}/projects/${projectId}/design-canvas`, {
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
      },
    });
    expect(seed.ok()).toBeTruthy();
  });

  test("loads studio with catalog and seeded canvas", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design/studio`);
    await expect(page.getByRole("heading", { name: "Design studio" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("design-asset-palette")).toBeVisible();
    await expect(page.getByTestId("catalog-bluestone-paver")).toBeVisible();
    await expect(page.getByTestId("design-studio-canvas")).toBeVisible();
    await expect(page.getByTestId("design-studio-counts")).toHaveText(/1 symbols/, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("design-studio-save")).toBeVisible();
  });

  test("shows indicative scale bar on canvas", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design/studio`);
    await expect(page.getByTestId("design-studio-scale-bar")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("design-studio-scale-bar")).toContainText(/m/);
  });

  test("places symbol from catalog click", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design/studio`);
    await expect(page.getByTestId("design-studio-counts")).toHaveText(/1 symbols/, {
      timeout: 30_000,
    });
    await page.getByTestId("catalog-lomandra-mass").click();
    const canvas = page.getByTestId("design-studio-canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await canvas.click({
      position: { x: (box?.width ?? 400) / 2, y: (box?.height ?? 280) / 2 },
    });
    await expect(page.getByTestId("design-studio-counts")).toHaveText(/2 symbols/, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("canvas-placement")).toHaveCount(2);
  });

  test("save plan from toolbar", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design/studio`);
    await expect(page.getByTestId("design-studio-save")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("design-studio-save").click();
    await expect(page.getByText(/All changes saved/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});
