import { expect, test } from "@playwright/test";
import { LEGACY_STUDIO_VIEWPORT, pipelineShell } from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

test.describe("Canvas-first + hub shell", () => {
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

  test("project root opens site canvas without pipeline chrome", async ({
    page,
  }) => {
    await page.goto(`/projects/${projectId}`);
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/?$`));
    await expect(page.getByTestId("site-canvas")).toBeVisible({
      timeout: 30_000,
    });
    await expect(pipelineShell(page)).toHaveCount(0);
  });

  test("design studio is canvas-first without pipeline chrome", async ({
    page,
  }) => {
    await page.setViewportSize(LEGACY_STUDIO_VIEWPORT);
    await page.goto(`/projects/${projectId}/design`);
    await expect(page.getByTestId("design-studio-canvas")).toBeVisible({
      timeout: 30_000,
    });
    await expect(pipelineShell(page)).toHaveCount(0);
  });

  test("overview hub still uses pipeline shell for ops tabs", async ({
    page,
  }) => {
    await page.goto(`/projects/${projectId}/overview`);
    const shell = pipelineShell(page);
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("pipeline-tab-overview")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("survey tab uses hub shell with lot metrics", async ({ page }) => {
    await page.goto(`/projects/${projectId}/survey`);
    const shell = pipelineShell(page);
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: "Re-run survey" }),
    ).toBeVisible({
      timeout: 15_000,
    });
  });
});
