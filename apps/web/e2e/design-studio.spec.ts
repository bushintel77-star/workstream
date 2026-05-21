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

    await expect(page.getByRole("heading", { name: "Design studio" })).toBeVisible();
    await expect(page.getByTestId("design-asset-palette")).toBeVisible();

    await page.getByTestId("catalog-bluestone-paver").click();
    const canvas = page.getByTestId("design-studio-canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);

    await expect(page.getByTestId("canvas-placement")).toHaveCount(1);

    await page.getByRole("button", { name: "Draw" }).click();
    const b = await canvas.boundingBox();
    await page.mouse.move(b!.x + 40, b!.y + 40);
    await page.mouse.down();
    await page.mouse.move(b!.x + 120, b!.y + 80, { steps: 8 });
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

  test("uploads custom SVG asset in settings", async ({ page }) => {
    await page.goto("/settings/design-assets");

    await expect(
      page.getByRole("heading", { name: "Design asset library" }),
    ).toBeVisible();

    await page.getByPlaceholder("e.g. Travertine pool coping").fill("E2E test shrub");
    await page.locator('textarea[name="path_d"]').fill("M8 40V20c0-6 4-10 8-10s8 4 8 10v20");
    await page.getByRole("button", { name: "Add to library" }).click();

    await expect(page.getByText("E2E test shrub")).toBeVisible({ timeout: 10_000 });
  });
});
