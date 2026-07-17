import { expect, test } from "@playwright/test";
import { LEGACY_STUDIO_VIEWPORT, pipelineShell } from "./helpers";

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

  test("project root opens site canvas", async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/?$`));
    await expect(page.getByTestId("site-canvas")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("overview uses immersive shell with aerial and pipeline rail", async ({
    page,
  }) => {
    await page.goto(`/projects/${projectId}/overview`);
    const shell = pipelineShell(page);
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
    await expect(
      page.getByRole("link", { name: "Open studio" }).first(),
    ).toBeVisible();
  });

  test("survey tab uses immersive shell with lot metrics", async ({ page }) => {
    await page.goto(`/projects/${projectId}/survey`);
    const shell = pipelineShell(page);
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(shell).toHaveAttribute("data-shell-variant", "immersive");
    await expect(page.getByTestId("pipeline-tab-survey")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByRole("button", { name: "Re-run survey" }),
    ).toBeVisible({
      timeout: 15_000,
    });
  });

  test("shell quick links navigate between studio and pipeline", async ({
    page,
  }) => {
    await page.setViewportSize(LEGACY_STUDIO_VIEWPORT);
    await page.goto(`/projects/${projectId}/design`);
    await expect(page.getByTestId("design-studio-canvas")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("link", { name: "Pipeline" }).first().click();
    await expect(page).toHaveURL(
      new RegExp(`/projects/${projectId}/overview$`),
    );
    await expect(pipelineShell(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("pipeline-tab-overview")).toHaveAttribute(
      "aria-current",
      "page",
    );

    await page.getByRole("link", { name: "Studio" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/design$`));
    await expect(page.getByTestId("design-studio-canvas")).toBeVisible({
      timeout: 30_000,
    });
  });
});
