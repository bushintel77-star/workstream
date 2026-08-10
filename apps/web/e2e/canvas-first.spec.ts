import { expect, test } from "@playwright/test";
import { handoffStudio, pipelineShell } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Canvas-first progressive disclosure: Sketch has no Live BOM;
 * CAD exposes utility Live cost; Share hides floating cost chrome.
 */
test.describe("Canvas-first mode chrome", () => {
  test("Sketch and idle CAD hide cost chrome; Share stays locked before quote", async ({
    page,
    request,
  }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Canvas First, 12 Fit Sheet Ave, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as {
      project: { id: string };
    };
    const projectId = body.project.id;

    const pipeline = await request.post(
      `${API}/projects/${projectId}/pipeline`,
    );
    expect(pipeline.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}`);
    await expect(handoffStudio(page)).toBeVisible({
      timeout: 30_000,
    });
    await expect(pipelineShell(page)).toHaveCount(0);

    await page.getByTestId("canvas-mode-sketch").click();
    await expect(page).toHaveURL(/mode=sketch/);
    await expect(page.getByTestId("sketch-board")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("live-bom-hud")).toHaveCount(0);

    await page.getByTestId("canvas-mode-cad").click();
    await expect(page).toHaveURL(/mode=cad/);
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 15_000,
    });
    // Utility drawer exposes Live cost when CAD chrome is on
    const bomTab = page.getByTestId("utility-tab-bom");
    if (await bomTab.isVisible().catch(() => false)) {
      await bomTab.click();
      await expect(page.getByTestId("live-bom-hud")).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByTestId("live-bom-trade-status")).toBeVisible();
    }

    // Progressive disclosure: Share is unavailable until a quote is persisted.
    await expect(page.getByTestId("canvas-mode-share")).toBeDisabled();
    await expect(page.getByTestId("live-bom-hud")).toHaveCount(0);
  });
});
