import { expect, test } from "@playwright/test";

const API = process.env.API_URL ?? "http://localhost:3001";

test.describe("Operator happy path", () => {
  test("dashboard → project hub after API create", async ({ page, request }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Operator Path, 88 Test Grove, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string; address: string } };
    const projectId = body.project.id;

    await page.goto("/");
    await expect(page.getByRole("link", { name: /projects/i })).toBeVisible();

    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText(body.project.address, { exact: false })).toBeVisible();

    const pipeline = await request.post(`${API}/projects/${projectId}/pipeline`);
    expect(pipeline.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}/design`);
    await expect(page.getByRole("heading", { name: /design/i })).toBeVisible();
  });
});
