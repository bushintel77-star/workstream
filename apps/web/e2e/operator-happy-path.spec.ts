import { expect, test } from "@playwright/test";
import { pipelineShell } from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

test.describe("Operator happy path", () => {
  test("one canvas after API create + pipeline", async ({ page, request }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Operator Path, 88 Test Grove, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as {
      project: { id: string; address: string };
    };
    const projectId = body.project.id;

    const pipeline = await request.post(
      `${API}/projects/${projectId}/pipeline`,
    );
    expect(pipeline.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}`);
    await expect(page.getByTestId("site-canvas")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("canvas-mode-strip")).toBeVisible();
    await expect(pipelineShell(page)).toHaveCount(0);

    await page.getByTestId("canvas-mode-sketch").click();
    await expect(page).toHaveURL(/mode=sketch/);
  });
});
