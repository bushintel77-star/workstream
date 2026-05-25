import { expect, test } from "@playwright/test";

const API = process.env.API_URL ?? "http://localhost:3001";

test.describe("Pipeline shell", () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Pipeline Shell, 12 Shell Street, Melbourne VIC 3000",
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

  test("project root redirects to studio with immersive shell", async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/design$`));
    const shell = page.getByTestId("project-pipeline-shell");
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(shell).toHaveAttribute("data-shell-variant", "immersive");
    await expect(page.getByTestId("pipeline-tab-design")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("overview uses immersive shell with aerial and pipeline rail", async ({ page }) => {
    await page.goto(`/projects/${projectId}/overview`);
    const shell = page.getByTestId("project-pipeline-shell");
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(shell).toHaveAttribute("data-shell-variant", "immersive");
    await expect(page.getByTestId("pipeline-tab-overview")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByTestId("pipeline-hub-image-shell")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("pipeline-aerial-canvas")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open studio" })).toBeVisible();
  });

  test("survey tab uses content shell", async ({ page }) => {
    await page.goto(`/projects/${projectId}/survey`);
    const shell = page.getByTestId("project-pipeline-shell");
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(shell).toHaveAttribute("data-shell-variant", "content");
    await expect(page.getByTestId("pipeline-tab-survey")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("heading", { name: "Survey" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("shell quick links navigate between studio and pipeline", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design`);
    await page.getByRole("link", { name: "Pipeline" }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/overview$`));
    await expect(page.getByTestId("pipeline-tab-overview")).toHaveAttribute(
      "aria-current",
      "page",
    );

    await page.getByRole("link", { name: "Studio" }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/design$`));
    await expect(page.getByTestId("design-studio-canvas")).toBeVisible({
      timeout: 30_000,
    });
  });
});
