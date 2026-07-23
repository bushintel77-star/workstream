import { expect, test } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";

/**
 * Lane law — no two `[data-camera-chrome-card]` bboxes may intersect.
 * Covers schedule cards + right-lane panels across zoom / rotation.
 */

function boxesIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

async function assertNoCardOverlap(page: import("@playwright/test").Page) {
  const boxes = await page.evaluate(() => {
    const nodes = [
      ...document.querySelectorAll("[data-camera-chrome-card]"),
    ] as HTMLElement[];
    return nodes
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          testId: el.getAttribute("data-testid") ?? el.tagName,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        };
      })
      .filter((b) => b.width > 2 && b.height > 2);
  });

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      expect(
        boxesIntersect(a, b),
        `overlap ${a.testId} × ${b.testId}`,
      ).toBe(false);
    }
  }
}

async function wheelZoom(
  page: import("@playwright/test").Page,
  deltaY: number,
) {
  const board = page.getByTestId("studio-board");
  await board.hover({ position: { x: 400, y: 280 } });
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(250);
}

test.describe("Lane law — chrome card overlap", () => {
  test("no schedule/panel card overlap at 3 zooms + rotated CAD", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("zoom-world")).toBeVisible({
      timeout: 15_000,
    });

    // Open layers (right lane) — must not sit under the tool tray.
    await page.getByTestId("canvas-layers-top").click();
    await expect(page.getByTestId("layers-panel")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("right-data-lane-layers")).toBeVisible();

    const layersBox = await page.getByTestId("layers-panel").boundingBox();
    const dockBox = await page.getByTestId("tool-dock").boundingBox();
    expect(layersBox).toBeTruthy();
    expect(dockBox).toBeTruthy();
    if (layersBox && dockBox) {
      expect(layersBox.x).toBeGreaterThan(dockBox.x + dockBox.width);
    }

    await page.screenshot({
      path: "e2e/screenshots/layers-right-slot.png",
      fullPage: false,
    });

    await page.getByTestId("dark-canvas-top").click();

    await assertNoCardOverlap(page);
    await wheelZoom(page, 400);
    await assertNoCardOverlap(page);
    await wheelZoom(page, -800);
    await assertNoCardOverlap(page);

    const rotate = page.getByTestId("view-rot-cw");
    if (await rotate.isVisible().catch(() => false)) {
      await rotate.click();
      await page.waitForTimeout(300);
      await assertNoCardOverlap(page);
    }

    await page.screenshot({
      path: "e2e/screenshots/cards-decluttered-night.png",
      fullPage: false,
    });

    // Mutual exclusion — opening sites closes layers.
    await page.getByTestId("canvas-sites-top").click();
    await expect(page.getByTestId("sites-popover")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("layers-panel")).toHaveCount(0);
  });
});
