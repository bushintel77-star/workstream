import { expect, test } from "@playwright/test";
import { pipelineShell } from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

/**
 * Canvas-first progressive disclosure: Sketch shows Instant Planner strip;
 * CAD exposes Walk + compact costing; Share hides Live BOM.
 */
test.describe("Canvas-first mode chrome", () => {
  test("Sketch Instant Planner; Paint disclosure; CAD Walk mounts", async ({
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
    await expect(page.getByTestId("site-canvas")).toBeVisible({
      timeout: 30_000,
    });
    await expect(pipelineShell(page)).toHaveCount(0);

    // Title reveal may gate docks — open Fit sheet if present.
    const openFit = page.getByTestId("start-cad-drawing");
    if (await openFit.isVisible().catch(() => false)) {
      await openFit.click();
    }

    await page.getByTestId("canvas-mode-sketch").click();
    await expect(page).toHaveURL(/mode=sketch/);

    await expect(page.getByTestId("live-bom-hud")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("cad-dock")).toHaveCount(0);

    const paint = page.getByTestId("sketch-paint-open");
    if (await paint.isVisible().catch(() => false)) {
      await expect(paint).toHaveText(/Paint/i);
      await paint.click();
      await expect(paint).toHaveText(/Hide brushes/i);
    }

    await page.getByTestId("canvas-mode-cad").click();
    await expect(page).toHaveURL(/mode=cad/);
    await expect(page.getByTestId("cad-dock")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("cad-walk")).toBeVisible();
    // Warm-mounted clay host (inactive until Walk toggled)
    await expect(page.getByTestId("clay-walkthrough")).toBeAttached();

    await page.getByTestId("cad-walk").click();
    await expect(page.getByTestId("clay-exit-walk")).toBeVisible();
    await page.getByTestId("clay-exit-walk").click();
    // Exit chip stays through the Walk cross-fade (~560ms), then unmounts.
    await expect(page.getByTestId("clay-exit-walk")).toHaveCount(0, {
      timeout: 2500,
    });
  });
});
