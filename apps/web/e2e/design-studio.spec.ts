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
  });

  test("places catalog asset and saves canvas", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design/studio`);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading", { name: "Design studio" })).toBeVisible();
    await expect(page.getByTestId("design-asset-palette")).toBeVisible();

    await page.getByTestId("catalog-bluestone-paver").click();

    const canvas = page.getByTestId("design-studio-canvas");
    await expect(canvas).toBeVisible();
    await canvas.click({ position: { x: 120, y: 120 } });

    await expect(page.getByTestId("canvas-placement")).toHaveCount(1, {
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Draw" }).click();
    await page.mouse.move(200, 160);
    await page.mouse.down();
    await page.mouse.move(280, 200, { steps: 6 });
    await page.mouse.up();

    await page.getByTestId("design-studio-save").click();
    await expect(page.getByText("Site plan saved")).toBeVisible({ timeout: 15_000 });

    const res = await page.request.get(`${API}/projects/${projectId}/design-canvas`);
    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as {
      canvas: { placements: unknown[]; strokes: unknown[] };
    };
    expect(json.canvas.placements.length).toBeGreaterThanOrEqual(1);
    expect(json.canvas.strokes.length).toBeGreaterThanOrEqual(1);
  });
});
