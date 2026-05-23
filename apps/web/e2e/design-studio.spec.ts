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
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Design studio" })).toBeVisible();
    await expect(page.getByTestId("design-asset-palette")).toBeVisible();

    const tile = page.getByTestId("catalog-bluestone-paver");
    await tile.scrollIntoViewIfNeeded();
    await expect(tile).toBeVisible();

    const canvas = page.getByTestId("design-studio-canvas");
    await expect(canvas).toBeVisible();

    await tile.dragTo(canvas, {
      targetPosition: { x: 120, y: 120 },
      force: true,
    });

    await expect(page.getByText(/1 symbols/)).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("design-studio-save").click();
    await expect(page.getByText("Site plan saved")).toBeVisible({ timeout: 15_000 });

    const res = await page.request.get(`${API}/projects/${projectId}/design-canvas`);
    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as {
      canvas: { placements: unknown[] };
    };
    expect(json.canvas.placements.length).toBeGreaterThanOrEqual(1);
  });
});
