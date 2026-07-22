import { expect, test } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";

/**
 * Gate C — zero `data-camera-chrome` nodes may live under `[data-testid=zoom-world]`.
 * All frosted / dock / HUD chrome must render through `CameraChrome` (portal).
 */

async function cameraChromeInsideZoom(page: import("@playwright/test").Page) {
  return page.locator('[data-testid="zoom-world"] [data-camera-chrome]').count();
}

test.describe("Camera chrome detector (gate C)", () => {
  test("deliberate mis-parent fails the detector, then clean tree passes", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("zoom-world")).toBeVisible({ timeout: 15_000 });

    // --- Fail path: inject chrome under the camera (proves the detector bites)
    await page.evaluate(() => {
      const zoom = document.querySelector('[data-testid="zoom-world"]');
      if (!zoom) throw new Error("zoom-world missing");
      const el = document.createElement("div");
      el.setAttribute("data-camera-chrome", "1");
      el.setAttribute("data-testid", "deliberate-misparent-chrome");
      el.textContent = "misparented";
      zoom.appendChild(el);
    });
    expect(await cameraChromeInsideZoom(page)).toBeGreaterThan(0);
    await expect(page.getByTestId("deliberate-misparent-chrome")).toBeVisible();

    // --- Clean path: remove injection; production tree must stay clean
    await page.evaluate(() => {
      document.querySelector('[data-testid="deliberate-misparent-chrome"]')?.remove();
    });
    expect(await cameraChromeInsideZoom(page)).toBe(0);

    // Zoom out — still zero chrome under the camera
    const board = page.getByTestId("studio-board");
    const box = await board.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, 900);
    await page.mouse.wheel(0, 900);
    expect(await cameraChromeInsideZoom(page)).toBe(0);

    // Portaled sketch toolbar must remain outside the camera
    const bar = page.getByTestId("sketch-convert-bar");
    await expect(bar).toBeVisible();
    const parenting = await bar.evaluate((el) => {
      const zoom = document.querySelector('[data-testid="zoom-world"]');
      const board = document.querySelector('[data-testid="studio-board"]');
      return {
        inZoom: Boolean(zoom && zoom.contains(el)),
        inBoard: Boolean(board && board.contains(el)),
        chromeShells: document.querySelectorAll("[data-camera-chrome]").length,
        chromeRootPresent: Boolean(
          document.querySelector('[data-testid="camera-chrome-root"]'),
        ),
      };
    });
    expect(parenting.inZoom).toBe(false);
    expect(parenting.inBoard).toBe(true);
    expect(parenting.chromeRootPresent).toBe(true);
    // Gate B: CameraChrome must stamp shells onto the board (dock chrome).
    expect(parenting.chromeShells).toBeGreaterThan(0);
  });

  test("CAD and Survey also have zero camera-chrome under zoom-world", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    for (const mode of ["survey", "cad"] as const) {
      await page.goto(`/projects/${projectId}?mode=${mode}`);
      await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("zoom-world")).toBeVisible({ timeout: 15_000 });
      const board = page.getByTestId("studio-board");
      const box = await board.boundingBox();
      expect(box).toBeTruthy();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.wheel(0, 700);
      expect(
        await cameraChromeInsideZoom(page),
        `mode=${mode} must have zero data-camera-chrome under zoom-world`,
      ).toBe(0);
    }
  });
});
