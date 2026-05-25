import { expect, test } from "@playwright/test";

const API = process.env.API_URL ?? "http://localhost:3001";

test.describe("Operator happy path", () => {
  test("project hub and design page after API create + pipeline", async ({
    page,
    request,
  }) => {
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

    const pipeline = await request.post(`${API}/projects/${projectId}/pipeline`);
    expect(pipeline.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}`);
    await expect(page.getByTestId("project-pipeline-shell")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("design-studio-canvas")).toBeVisible({
      timeout: 30_000,
    });

    await page.goto(`/projects/${projectId}/overview`);
    await expect(page.getByTestId("project-pipeline-shell")).toHaveAttribute(
      "data-shell-variant",
      "immersive",
    );
    await expect(page.getByTestId("pipeline-hub-image-shell")).toBeVisible({
      timeout: 30_000,
    });

    await page.goto(`/projects/${projectId}/design`);
    await expect(page.getByTestId("project-pipeline-shell")).toHaveAttribute(
      "data-shell-variant",
      "immersive",
    );
    await expect(page.getByTestId("design-studio-image-shell")).toBeVisible({
      timeout: 30_000,
    });
  });
});
